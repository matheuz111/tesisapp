const fs = require('fs');
const path = require('path');

const ignoreList = [
    'node_modules', '.git', '.expo', 'assets', '.next', 'dist',
    'build', 'package-lock.json', 'package.json', '.DS_Store', 'scripts',
    'full_codebase_report.md', 'script.js'
];

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (ignoreList.some(ignore => file.includes(ignore))) continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const isTextFile = (file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx', '.json', '.rules'].includes(ext);
};

const root = process.cwd();
const allFiles = getFiles(root).filter(isTextFile);

let report = '# Contexto Completo: Service Marketplace App\n\nEste documento contiene el código fuente completo del proyecto.\n\n';

for (const file of allFiles) {
    const relativePath = file.replace(root + path.sep, '');
    let ext = path.extname(file).slice(1);
    if (ext === 'rules') ext = 'javascript';

    report += `\n=========================================\nArchivo: ${relativePath}\n=========================================\n\n\`\`\`${ext}\n`;
    report += fs.readFileSync(file, 'utf8') + '\n\`\`\`\n';
}

fs.writeFileSync('C:/Users/rujel/.gemini/antigravity/brain/2301fbc4-b976-45dc-8121-deb0edc1214c/full_codebase_report.md', report);
console.log('Report saved successfully');
