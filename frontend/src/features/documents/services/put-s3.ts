import axios from 'axios'

export async function uploadFile(url: string, file: File, onProgress?: (percent: number) => void) {
  await axios.put(url, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total))
    },
  })
}
