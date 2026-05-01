import fs from "fs";
import path from "path";

const cwd = process.cwd();

const candidates = [
  cwd,
  path.join(cwd, ".agents", "context"),
  path.join(cwd, "docs"),
];

const findFile = (dir, name) => {
  const filePath = path.join(dir, name);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
};

const readFileSafe = (filePath) => {
  if (!filePath) return "";
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

let contextDir = null;
let productPath = null;
let designPath = null;

for (const dir of candidates) {
  const product = findFile(dir, "PRODUCT.md") || findFile(dir, "product.md");
  const design = findFile(dir, "DESIGN.md") || findFile(dir, "design.md");
  if (product || design) {
    contextDir = dir;
    productPath = product;
    designPath = design;
    break;
  }
}

const output = {
  contextDir,
  product: {
    path: productPath,
    content: readFileSafe(productPath),
  },
  design: {
    path: designPath,
    content: readFileSafe(designPath),
  },
};

process.stdout.write(JSON.stringify(output, null, 2));
