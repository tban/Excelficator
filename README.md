# 📊 Excelficator

**Transforma imágenes de tablas en hojas de cálculo Excel usando OCR**

Excelficator es una aplicación web que utiliza reconocimiento óptico de caracteres (OCR) para extraer datos de imágenes de tablas y convertirlos automáticamente en archivos Excel estructurados.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Características

- 🖼️ **Arrastrar y soltar** - Sube múltiples imágenes fácilmente
- ✂️ **Recorte interactivo** - Selecciona solo el área de la tabla que te interesa
- 🔍 **Detección automática de columnas** - Identifica la estructura de la tabla automáticamente
- 🎛️ **Filtros configurables** - Excluye columnas o filas específicas antes de generar el Excel
- 📁 **Archivo de origen** - Cada fila indica de qué imagen proviene
- 📈 **Estadísticas de precisión** - Muestra el nivel de confianza del OCR
- 💾 **Exportación a Excel** - Descarga el resultado en formato .xlsx

## 🚀 Instalación

### Requisitos previos

- Node.js 18 o superior
- npm

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tban/Excelficator.git
   cd Excelficator
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 📖 Uso

### Flujo básico

1. **Sube imágenes** - Arrastra o selecciona las imágenes de las tablas que quieres convertir
2. **Recorta (opcional)** - Haz clic en el icono de recorte para seleccionar solo el área de datos
3. **Procesa** - Haz clic en "Procesar y Convertir a Excel"
4. **Configura filtros** - Revisa las columnas detectadas y configura filtros si es necesario:
   - Desmarca columnas que no quieras incluir
   - Añade reglas para omitir filas que contengan cierto texto
5. **Descarga** - Obtén tu archivo Excel listo para usar

### Consejos para mejores resultados

- 📷 Usa imágenes de **alta resolución** (al menos 150 DPI)
- 🔲 Asegúrate de que las **líneas de la tabla sean visibles**
- ✂️ Recorta la imagen para incluir **solo el área de datos**
- 📐 Evita imágenes con **ángulos o distorsiones**

## 🏗️ Arquitectura

```
Excelficator/
├── public/
│   ├── index.html      # Interfaz de usuario
│   ├── styles.css      # Estilos
│   └── app.js          # Lógica del frontend
├── src/
│   ├── server.js       # Servidor Express
│   └── ocr-processor.js # Procesador OCR y generación Excel
├── package.json
└── README.md
```

### Tecnologías utilizadas

- **Backend**: Node.js, Express
- **OCR**: Tesseract.js (español + inglés)
- **Excel**: ExcelJS
- **Frontend**: HTML5, CSS3, JavaScript vanilla

## 🔧 API

### POST `/api/detect`
Detecta columnas en la primera imagen para configurar filtros.

**Request**: `multipart/form-data` con campo `images`

**Response**:
```json
{
  "success": true,
  "columns": ["Columna1", "Columna2", ...],
  "sampleData": [...],
  "imagePaths": [...],
  "totalImages": 5
}
```

### POST `/api/process`
Procesa las imágenes con los filtros configurados.

**Request**:
```json
{
  "imagePaths": [...],
  "filters": {
    "excludeColumns": ["Columna2"],
    "omitText": [{"column": "Estado", "text": "Inactivo"}]
  }
}
```

**Response**:
```json
{
  "success": true,
  "downloadUrl": "/api/download/excelficator-xxx.xlsx",
  "preview": [...],
  "columns": [...],
  "totalRows": 150,
  "stats": {
    "accuracyPercent": 92,
    "errorPercent": 8
  }
}
```

### GET `/api/download/:filename`
Descarga el archivo Excel generado.

## 📝 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

## 👤 Autor

Desarrollado por [@TbanR](https://twitter.com/TbanR)

---

⭐ Si este proyecto te resulta útil, ¡dale una estrella en GitHub!
