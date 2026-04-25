import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  initialUrl?: string | null;
  label?: string;
  accept?: string;
  className?: string;
}

const isVideo = (url: string) => {
  if (!url) return false;
  return /\.(mp4|webm|ogg)$/i.test(url);
}

/**
 * Compresses and resizes an image file using a canvas.
 * Returns a base64 data URI (JPEG).
 */
const compressImage = (file: File, maxPx = 1200, quality = 0.85): Promise<string> => {
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
        // Use original format if webp/png, otherwise jpeg
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ImageUploader = ({ 
    onUploadSuccess, 
    onUploadStart,
    onUploadError,
    initialUrl, 
    label, 
    accept = "image/png, image/jpeg, image/webp",
    className
}: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialUrl || null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setMediaUrl(initialUrl || null);
    setUploadError(null);
  }, [initialUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    onUploadStart?.();

    try {
      console.log('[ImageUploader] Iniciando upload via Cloudinary...', { fileName: file.name, fileType: file.type, fileSize: file.size });

      // Comprime/redimensiona a imagem antes de enviar (máx 1200px, qualidade 85%)
      const base64data = await compressImage(file, 1200, 0.85);
      console.log('[ImageUploader] Tamanho após compressão:', Math.round(base64data.length / 1024), 'KB');

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

      if (!response.ok) {
        throw new Error(data?.error || `Erro ${response.status} no servidor.`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.secure_url) {
        throw new Error(data?.details || 'Cloudinary não retornou uma URL válida.');
      }

      const { secure_url } = data;
      setMediaUrl(secure_url);
      onUploadSuccess(secure_url);
      console.log("[ImageUploader] Upload Cloudinary bem-sucedido:", secure_url);
      showSuccess("Arquivo enviado com sucesso!");
    } catch (err: any) {
      console.error("[ImageUploader] Falha no upload:", err);
      const errorMsg = err?.message || 'Falha no upload do arquivo.';
      setUploadError(errorMsg);
      showError(errorMsg);
      onUploadError?.(errorMsg);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  
  const handleRemoveMedia = () => {
    setMediaUrl(null);
    setUploadError(null);
    onUploadSuccess("");
  };

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm">{label || "Arquivo"}</label>
      {mediaUrl ? (
        <div className={cn(
          "relative border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center",
          "aspect-square w-full max-w-[300px]",
          className
        )}>
          {isVideo(mediaUrl) ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 z-10 shadow-md"
            onClick={handleRemoveMedia}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-md bg-gray-50/50 hover:bg-gray-50 transition-colors",
          "aspect-square w-full max-w-[300px]",
          uploading && "cursor-not-allowed opacity-60",
          uploadError && "border-red-300 bg-red-50/50",
          className
        )}>
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-xs text-muted-foreground font-medium">Enviando...</p>
            </>
          ) : (
            <>
              <UploadCloud className={cn("h-8 w-8", uploadError ? "text-red-400" : "text-muted-foreground")} />
              <p className="mt-2 text-xs text-muted-foreground font-medium text-center px-4">
                {uploadError ? "Clique para tentar novamente" : "Arraste ou clique para enviar"}
              </p>
              <Input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept={accept}
                disabled={uploading}
              />
            </>
          )}
        </div>
      )}
      
      {uploadError && (
        <div className="flex items-start gap-2 text-xs text-red-600 mt-1 px-1">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
