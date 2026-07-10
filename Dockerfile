FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/backend/public
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV QI_DATA_DIR=/data

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/public ./backend/public
COPY --from=backend-build /app/backend/config ./backend/config
COPY --from=backend-build /app/backend/prisma ./backend/prisma

EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
