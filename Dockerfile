# ProjectElec: Node app + LibreOffice (DOCX -> PDF) + poppler (page previews) + Thai fonts.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-writer-nogui poppler-utils fontconfig fonts-dejavu-core fonts-tlwg-laksaman \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

# TH SarabunPSK (fonts/THSarabun*.ttf) is what the handbook requires; Laksaman is the metric-compatible fallback.
RUN mkdir -p /usr/share/fonts/truetype/projectelec \
 && cp fonts/*.ttf /usr/share/fonts/truetype/projectelec/ \
 && cp fontconfig/projectelec.conf /etc/fonts/conf.d/60-projectelec.conf \
 && fc-cache -f

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
