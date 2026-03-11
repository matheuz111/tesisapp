const fs = require('fs');
const files = [
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/provider/home.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/client/home.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/client/history.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/provider/history.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/index.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/auth/login.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/src/context/ThemeContext.tsx',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/utils/pushNotifications.ts',
    'C:/Users/rujel/OneDrive/Documentos/TesisProyect/TesisApp/app/client/map.tsx'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);

        // Filtramos las líneas que son comentarios "exagerados" o de IA
        const cleanLines = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('//')) return true; // Mantener código normal

            const text = trimmed.substring(2).trim();

            // Lista de patrones a eliminar
            if (text.startsWith('🚀')) return false;
            if (text.startsWith('🚨')) return false;
            if (/^[1-9]\./.test(text)) return false; // "1. ", "2. ", etc
            if (text.startsWith('--')) return false; // "-- GAMIFIED HEADER --"
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
        newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up empty lines

        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Cleaned:', file);
    }
});
