# Imagens do catálogo (dev)

- **Pixabay**: URLs no manifest seguem o formato da API/CDN descrito em https://pixabay.com/api/docs/  
  Licença Pixabay Content License — em apps públicos, indique a origem quando exibir resultados.
- **Fallback Picsum**: usado só se o download Pixabay falhar; substitua por fotos reais do produto antes de produção.

Próximo passo: `npm run catalog:upload` para enviar estes ficheiros ao bucket Supabase e gerar `storage-urls.json`.
