// patch-rollup.js: ensures rollup falls back to @rollup/wasm-node when native DLL is blocked by Windows AppLocker
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Replace old patch if present
  if (code.includes('require("@rollup/wasm-node");')) {
    code = code.replace('require("@rollup/wasm-node");', 'require("@rollup/wasm-node/dist/native.js");');
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`[patch-rollup] Updated patch in ${filePath}`);
    return;
  }
  
  if (code.includes("require('@rollup/wasm-node/dist/native.js')")) return;
  
  const target = 'const requireWithFriendlyError = id => {\n\ttry {\n\t\treturn require(id);\n\t} catch (error) {';
  const replacement = 'const requireWithFriendlyError = id => {\n\ttry {\n\t\treturn require(id);\n\t} catch (error) {\n\t\ttry { return require("@rollup/wasm-node/dist/native.js"); } catch (e) {}';
  
  if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`[patch-rollup] Patched ${filePath}`);
  }
}

// Find all native.js instances in node_modules
function findNativeFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findNativeFiles(fullPath);
    } else if (entry.name === 'native.js' && fullPath.includes('rollup') && !fullPath.includes('wasm-node')) {
      patchFile(fullPath);
    }
  }
}

findNativeFiles(path.join(__dirname, 'node_modules'));
