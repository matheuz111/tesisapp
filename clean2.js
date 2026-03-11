const fs = require('fs');
const path = require('path');

const files = [
    'app/provider/home.tsx',
    'app/client/home.tsx',
    'app/client/history.tsx',
    'app/provider/history.tsx',
    'app/index.tsx',
    'app/auth/login.tsx',
    'src/context/ThemeContext.tsx',
    'utils/pushNotifications.ts',
    'app/client/map.tsx'
];

files.forEach(filepath => {
    const fullPath = path.join(__dirname, filepath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);

        const cleanLines = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('//')) return true;

            const text = trimmed.substring(2).trim();

            if (text.startsWith('🚀')) return false;
            if (text.startsWith('🚨')) return false;
            if (/^[1-9]\./.test(text)) return false;
            if (text.startsWith('--')) return false;
            if (text.startsWith('ESTADO')) return false;
            if (text.startsWith('MODO')) return false;
            if (text.startsWith('EFECTO')) return false;
            if (text.startsWith('BOTÓN')) return false;
            if (text.startsWith('PANEL')) return false;
            if (text.startsWith('FUNCIÓN')) return false;
            if (text.startsWith('CÁLCULO')) return false;
            if (text.startsWith('IMPORTACIÓN')) return false;
            if (text.startsWith('REGISTRO')) return false;
            if (text.startsWith('ESCUCHAR')) return false;
            if (text.startsWith('NUEVO:')) return false;
            if (text.startsWith('CONSULTA')) return false;
            if (text.startsWith('IMPORTAR')) return false;
            if (text.startsWith('ENVOLVER')) return false;
            if (text.startsWith('DEFINIR')) return false;
            if (text.includes('CRITICAL FIX')) return false;
            if (text.includes('EXIGIDO POR LA NUEVA VERSIÓN DE EXPO')) return false;
            if (text.includes('AQUÍ ESTÁ LA LLAMADA')) return false;

            return true;
        });

        let newContent = cleanLines.join('\n');
        newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');

        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Cleaned:', fullPath);
    } else {
        console.log('File not found:', fullPath);
    }
});
