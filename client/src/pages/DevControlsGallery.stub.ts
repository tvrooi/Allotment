// Used instead of DevControlsGallery.tsx in every build except the gallery build
// (`vite build --mode gallery`, see withoutDevGallery() in vite.config.ts), so no shipped
// bundle has the gallery or its specimens
export default function DevControlsGallery(): null {
  return null;
}
