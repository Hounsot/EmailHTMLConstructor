// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {
  width: 524,
  height: 800,
  title: 'Конфигуратор рассылки'
})

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
async function convertAutoLayoutToTable(frame: FrameNode) {
  // Check if the node is AutoLayout
  if (!frame.layoutMode) {
    figma.notify('Selected node is not an AutoLayout frame')
    return
  }
  // Extract properties of the frame
  const styles = extractStyles(frame)
  let html = `<table border="0" cellspacing="0" cellpadding="0" style="${styles}">\n`

  // Recursively process children (nested AutoLayouts or other nodes)
  for (const child of frame.children) {
    html += await processChildNode(child) // Pass `false` to indicate it's not top-level
  }

  html += `</table>`
  return html
}

function extractStyles(node: SceneNode): string {
  const styles = []

  // Extract width and height for frames and auto layouts
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE' || node.type === 'RECTANGLE') {
    if (node.width) styles.push(`width:${node.width}px;`)
    if (node.height) styles.push(`height:${node.height}px;`)
    // Extract padding (from AutoLayout settings)
    if ('paddingLeft' in node) styles.push(`padding-left:${node.paddingLeft}px;`)
    if ('paddingRight' in node) styles.push(`padding-right:${node.paddingRight}px;`)
    if ('paddingTop' in node) styles.push(`padding-top:${node.paddingTop}px;`)
    if ('paddingBottom' in node) styles.push(`padding-bottom:${node.paddingBottom}px;`)
  }

  // Extract background color (fill) if available
  if (node.fills && node.fills.length > 0 && node.fills[0].type === 'SOLID' && node.type != 'TEXT') {
    const fill = node.fills[0] as SolidPaint
    const { r, g, b } = fill.color
    const alpha = fill.opacity !== undefined ? fill.opacity : 1
    const backgroundColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
    styles.push(`background-color: ${backgroundColor};`)
  }

  // Extract text styles for text nodes
  if (node.type === 'TEXT') {
    const textNode = node as TextNode

    // Extract font-family (e.g., Arial, sans-serif)
    styles.push(`font-family: ${textNode.fontName.family}, sans-serif;`)

    // Extract font-weight (normal, bold, etc.)
    styles.push(`font-weight: ${textNode.fontName.style};`)

    // Extract font-size
    styles.push(`font-size: ${textNode.fontSize}px;`)

    // Extract line-height (Figma uses percentage-based line heights)
    if (textNode.lineHeight && textNode.lineHeight.unit === 'PIXELS') {
      styles.push(`line-height: ${textNode.lineHeight.value}px;`)
    } else if (textNode.lineHeight && textNode.lineHeight.unit === 'PERCENT') {
      const calculatedLineHeight = (textNode.lineHeight.value / 100) * textNode.fontSize
      styles.push(`line-height: ${calculatedLineHeight}px;`)
    }

    // Extract text-align (if present)
    if ('textAlignHorizontal' in textNode) {
      if (textNode.textAlignHorizontal === 'CENTER') {
        styles.push('text-align: center;')
      } else if (textNode.textAlignHorizontal === 'LEFT') {
        styles.push('text-align: left;')
      } else if (textNode.textAlignHorizontal === 'RIGHT') {
        styles.push('text-align: right;')
      }
    }

    // Extract color (Figma uses RGBA)
    if (textNode.fills.length > 0 && textNode.fills[0].type === 'SOLID') {
      const fill = textNode.fills[0] as SolidPaint
      const { r, g, b } = fill.color
      const alpha = fill.opacity !== undefined ? fill.opacity : 1
      const color = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
      styles.push(`color: ${color};`)
    }
  }

  return styles.join(' ')
}

async function processChildNode(node: SceneNode): Promise<string> {
  let html = ''

  if ((node.type === 'INSTANCE' || node.type === 'FRAME') && node.layoutMode && node.name !== 'Image Frame') {
    // Check if the node has child instances or frames
    const hasNestedFrames = node.children.some(
      (child) => (child.type === 'INSTANCE' || child.type === 'FRAME') && child.name !== 'Image Frame'
    )

    const styles = extractStyles(node)

    if (hasNestedFrames) {
      html += `<tr id="${node.name}" border="0" cellspacing="0" cellpadding="0" style="${styles}"><td style="vertical-align: top;"><table style="table-layout: fixed; ${styles}>\n`
    } else {
      html += `<tr id="${node.name}" border="0" cellspacing="0" cellpadding="0" style="${styles}">\n`
    }

    for (const child of node.children) {
      html += await processChildNode(child)
    }

    if (hasNestedFrames) {
      html += `</table></td></tr>\n`
    } else {
      html += `</tr>\n`
    }
  } else if (node.type === 'TEXT') {
    // Handle the text node logic
    html += `<td style="${extractStyles(node)}">${await getTextContent(node)}</td>\n`
  } else if (node.name === 'Image Frame') {
    // Handle the image frame logic
    html += `<td style="${extractStyles(
      node
    )}"><img src="https://parametr.space/media/cache/homepage_about_image_xxl/uploads/47/kuvekino_04_1713956437.jpg" width="${
      node.width
    }" height="${node.height}" style="display: block;"></td>\n`
  }
  return html
}

// Helper function to extract text content from a TextNode
async function getTextContent(textNode: TextNode): Promise<string> {
  return textNode.characters
}
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'convert') {
    const selectedNodes = figma.currentPage.selection
    if (selectedNodes.length === 0) {
      figma.notify('Please select a frame with AutoLayout.')
      return
    }
    console.log('Frame with AutoLayout is selected')

    // Assume the first selected node is the target
    const selectedFrame = selectedNodes[0] as FrameNode
    console.log(`${selectedFrame} Selected Frame`)
    const html = await convertAutoLayoutToTable(selectedFrame)
    console.log(`${html}`)

    // Send the generated HTML back to the UI for copying or preview
    figma.ui.postMessage({ type: 'html', html: html })
  }
}
