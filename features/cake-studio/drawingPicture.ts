/**
 * A PNG of the drawn 2D cake (BUN-185), for designs made without the 3D view,
 * so the cart, the order and the kitchen still get a picture. The drawing's
 * colours are CSS variables, which a standalone SVG image can't read, so each
 * shape's computed colours are written into the copy first.
 */
const PAINT = ["fill", "stroke", "stop-color"] as const;

export async function drawingPicture(svg: SVGSVGElement, size = 720): Promise<string | null> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((element, i) => {
    const style = getComputedStyle(element);
    for (const property of PAINT) {
      const value = style.getPropertyValue(property);
      if (value) to[i].setAttribute(property, value);
    }
    if (element instanceof SVGTextElement) {
      to[i].setAttribute("font-family", style.fontFamily);
    }
  });
  const box = svg.viewBox.baseVal;
  copy.setAttribute("width", String(size));
  copy.setAttribute("height", String(Math.round((size * box.height) / box.width)));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = Math.round((size * box.height) / box.width);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = getComputedStyle(svg).getPropertyValue("--color-white") || "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
