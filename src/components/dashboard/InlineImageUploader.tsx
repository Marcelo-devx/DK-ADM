import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, ImageOff } from "lucide-react";

interface InlineImageUploaderProps {
  cardId: number;
  initialUrl: string | null;
  onUploadSuccess: (cardId: number, newUrl: string) => void;
}

const compressImage = (file: File, maxPx = 900, quality = 0.80): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao carregar a imagem.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round((height * maxPx) / width);
            width = maxPx;
          } else {
            width = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não disponível.'));
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const InlineImageUploader = ({ cardId, initialUrl, onUploadSuccess }: InlineImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialUrl);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const base64data = await compressImage(file, 900, 0.80);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/cloudinary-upload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ image: base64data }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Erro ${response.status} no servidor.`);
      }

      const { secure_url } = data;
      setMediaUrl(secure_url);
      onUploadSuccess(cardId, secure_url);
      showSuccess("Imagem atualizada com sucesso!");
    } catch (err: any) {
      console.error("[InlineImageUploader] Erro no upload:", err);
      let errorMsg = err?.message || "Falha no upload do arquivo.";
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Erro de conexão com o servidor. Tente novamente.';
      }
      showError(errorMsg);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="relative w-24 h-12 group">
      <label htmlFor={`inline-upload-${cardId}`} className="cursor-pointer">
        {uploading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : mediaUrl ? (
          <img src={mediaUrl} alt="Info Card" className="w-full h-full rounded-md object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md">
            <ImageOff className="h-6 w-6 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition-all rounded-md">
          <UploadCloud className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </label>
      <Input
        id={`inline-upload-${cardId}`}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        disabled={uploading}
      />
    </div>
  );
};