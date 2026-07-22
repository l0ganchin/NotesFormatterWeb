import JSZip from 'jszip'

// Append generated content into an existing .docx without disturbing anything
// the target document already contains.
//
// Word lists live in word/numbering.xml: paragraphs reference a numId, which
// maps to an abstractNum definition. docx-merger (the library this replaces)
// renamed the merged definitions WITHOUT updating the paragraphs referencing
// them, so every bullet in a merged document pointed at a missing list and
// Word "repaired" them into one running numbered list.
//
// The correct merge, done here: copy the appended document's list definitions
// into the target under fresh IDs guaranteed not to collide (max existing ID
// + 1), rewrite the appended body's references to those new IDs, and leave
// every byte of the target's own definitions alone. Appended bullets stay
// live Word lists; the target's lists, styles, headers, and table of contents
// are untouched.

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PAGE_BREAK_XML = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
const NUMBERING_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'
const NUMBERING_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering'

// Body content of a document.xml, without the trailing section properties
function extractBody(documentXml) {
  let xml = documentXml.substring(documentXml.indexOf('<w:body>') + 8)
  xml = xml.substring(0, xml.indexOf('</w:body>'))
  const sectPr = xml.lastIndexOf('<w:sectPr')
  if (sectPr !== -1) {
    xml = xml.substring(0, sectPr)
  }
  return xml
}

function maxAttrValue(xml, regex) {
  let max = 0
  for (const match of xml.matchAll(regex)) {
    max = Math.max(max, parseInt(match[1], 10))
  }
  return max
}

// Extract complete <tag ...>...</tag> blocks. The trailing ">" in the closing
// tag keeps "</w:num>" from matching inside "</w:numbering>".
function extractBlocks(xml, tag) {
  const re = new RegExp(`<${tag} [\\s\\S]*?</${tag}>`, 'g')
  return xml.match(re) || []
}

// Merge the appended document's numbering definitions into the target's
// numbering.xml under non-colliding IDs, and remap the appended body's
// references to match. Returns { numberingXml, bodyXml }.
function mergeNumberingDefinitions(targetNumberingXml, appendNumberingXml, appendBodyXml) {
  const closingIdx = targetNumberingXml.indexOf('</w:numbering>')
  if (closingIdx === -1) {
    // Malformed/unexpected numbering part: leave both sides untouched rather
    // than risk corrupting the target (appended bullets may degrade to plain
    // paragraphs, but nothing existing is damaged)
    return { numberingXml: targetNumberingXml, bodyXml: appendBodyXml }
  }

  const maxAbstractId = maxAttrValue(targetNumberingXml, /<w:abstractNum [^>]*?w:abstractNumId="(\d+)"/g)
  const maxNumId = maxAttrValue(targetNumberingXml, /<w:num [^>]*?w:numId="(\d+)"/g)

  const abstractBlocks = extractBlocks(appendNumberingXml, 'w:abstractNum')
  const numBlocks = extractBlocks(appendNumberingXml, 'w:num')

  // Old ID -> new ID maps (new IDs start above anything the target uses)
  const abstractMap = new Map()
  abstractBlocks.forEach((block, i) => {
    const m = block.match(/w:abstractNumId="(\d+)"/)
    if (m) abstractMap.set(m[1], String(maxAbstractId + 1 + i))
  })
  const numMap = new Map()
  numBlocks.forEach((block, i) => {
    const m = block.match(/<w:num [^>]*?w:numId="(\d+)"/)
    if (m) numMap.set(m[1], String(maxNumId + 1 + i))
  })

  // Two-pass placeholder replacement so remapping can never chain
  // (e.g. 1 -> 3 followed by 3 -> 5 rewriting the first result)
  const remap = (xml, map, patterns) => {
    let out = xml
    for (const [oldId] of map) {
      for (const [prefix, suffix] of patterns) {
        out = out.replaceAll(`${prefix}${oldId}${suffix}`, `${prefix}__PH_${oldId}__${suffix}`)
      }
    }
    for (const [oldId, newId] of map) {
      out = out.replaceAll(`__PH_${oldId}__`, newId)
    }
    return out
  }

  const remappedAbstract = abstractBlocks
    .map((block) => remap(block, abstractMap, [['w:abstractNumId="', '"']]))
    .join('')
  const remappedNums = numBlocks
    .map((block) => {
      let out = remap(block, numMap, [['<w:num w:numId="', '"']])
      out = remap(out, abstractMap, [['<w:abstractNumId w:val="', '"/>']])
      return out
    })
    .join('')
  const bodyXml = remap(appendBodyXml, numMap, [['<w:numId w:val="', '"/>']])

  // Schema order in numbering.xml: all abstractNum elements come before all
  // num elements. Insert ours accordingly.
  let merged = targetNumberingXml
  const firstNumIdx = merged.indexOf('<w:num ')
  const abstractInsertAt = firstNumIdx !== -1 ? firstNumIdx : merged.indexOf('</w:numbering>')
  merged = merged.slice(0, abstractInsertAt) + remappedAbstract + merged.slice(abstractInsertAt)
  const numInsertAt = merged.indexOf('</w:numbering>')
  merged = merged.slice(0, numInsertAt) + remappedNums + merged.slice(numInsertAt)

  return { numberingXml: merged, bodyXml }
}

// Target has no numbering part at all: install the appended document's
// numbering.xml and wire it into the package (content type + relationship)
async function installNumberingPart(zip, numberingXml) {
  zip.file('word/numbering.xml', numberingXml)

  const contentTypesPath = '[Content_Types].xml'
  let contentTypes = await zip.file(contentTypesPath).async('string')
  if (!contentTypes.includes('PartName="/word/numbering.xml"')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      `<Override PartName="/word/numbering.xml" ContentType="${NUMBERING_CONTENT_TYPE}"/></Types>`
    )
    zip.file(contentTypesPath, contentTypes)
  }

  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)
  if (relsFile) {
    let rels = await relsFile.async('string')
    if (!rels.includes('Target="numbering.xml"')) {
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="rIdNotesFormatterNumbering" Type="${NUMBERING_REL_TYPE}" Target="numbering.xml"/></Relationships>`
      )
      zip.file(relsPath, rels)
    }
  }
}

// Append a generated .docx into an existing .docx. The appended content starts
// on the page after the existing document's last content (exactly one page
// break, no blank page), and bullets on both sides remain live Word lists.
export async function mergeDocxBlobs(existingArrayBuffer, appendArrayBuffer) {
  const appendZip = await JSZip.loadAsync(appendArrayBuffer)
  let bodyXml = extractBody(await appendZip.file('word/document.xml').async('string'))
  const appendNumberingFile = appendZip.file('word/numbering.xml')

  const zip = await JSZip.loadAsync(existingArrayBuffer)

  if (appendNumberingFile) {
    const appendNumberingXml = await appendNumberingFile.async('string')
    const targetNumberingFile = zip.file('word/numbering.xml')

    if (targetNumberingFile) {
      const targetNumberingXml = await targetNumberingFile.async('string')
      const merged = mergeNumberingDefinitions(targetNumberingXml, appendNumberingXml, bodyXml)
      bodyXml = merged.bodyXml
      zip.file('word/numbering.xml', merged.numberingXml)
    } else {
      await installNumberingPart(zip, appendNumberingXml)
    }
  }

  let docXml = await zip.file('word/document.xml').async('string')
  let insertAt = docXml.lastIndexOf('<w:sectPr')
  if (insertAt === -1) {
    insertAt = docXml.lastIndexOf('</w:body>')
  }
  docXml = docXml.slice(0, insertAt) + PAGE_BREAK_XML + bodyXml + docXml.slice(insertAt)
  zip.file('word/document.xml', docXml)

  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME })
}
