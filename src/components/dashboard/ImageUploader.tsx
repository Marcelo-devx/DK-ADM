import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  initialUrl?: string | null;
  label?: string;
  accept?: string;
  className?: string;
}

const isVideo = (url: string) => {
  if (!url) return false;
  return /\.(mp4|webm|ogg)$/i.test(url);
}

export const ImageUploader = ({ 
    onUploadSuccess, 
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

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        console.log('[ImageUploader] Iniciando upload via Cloudinary...', { fileName: file.name, fileType: file.type, fileSize: file.size });

        const result = await apiClient.invoke<{ secure_url?: string; error?: string; details?: string }>("cloudinary-upload", {
          image: base64data,
        });

        if (result.error) {
          throw new Error(result.error);
        }

        if (!result.data?.secure_url) {
          throw new Error(result.data?.details || result.data?.error || 'Cloudinary não retornou uma URL válida.');
        }

        const { secure_url } = result.data;
        setMediaUrl(secure_url);
        onUploadSuccess(secure_url);
        console.log("[ImageUploader] Upload Cloudinary bem-sucedido:", secure_url);
        showSuccess("Arquivo enviado com sucesso!");
      } catch (err: any) {
        console.error("[ImageUploader] Falha no upload:", err);
        const errorMsg = err?.message || 'Falha no upload do arquivo.';
        setUploadError(errorMsg);
        showError(errorMsg);
      } finally {
        setUploading(false);
      }
    };
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
                Arraste ou clique para enviar
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