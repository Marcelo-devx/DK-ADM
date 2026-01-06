import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  initialUrl?: string | null;
  label?: string;
  accept?: string;
}

const isVideo = (url: string) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg)$/i.test(url);
}

export const ImageUploader = ({ 
    onUploadSuccess, 
    initialUrl, 
    label, 
    accept = "image/png, image/jpeg, image/webp" 
}: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialUrl || null);

  useEffect(() => {
    setMediaUrl(initialUrl || null);
  }, [initialUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        const { data, error } = await supabase.functions.invoke("cloudinary-upload", {
          body: { image: base64data },
        });

        if (error) throw error;

        const { secure_url } = data;
        setMediaUrl(secure_url);
        onUploadSuccess(secure_url);
        showSuccess("Arquivo enviado com sucesso!");
      } catch (err: any) {
        console.error("Error uploading file:", err);
        showError(err.message || "Falha no upload do arquivo.");
      } finally {
        setUploading(false);
      }
    };
  };
  
  const handleRemoveMedia = () => {
    setMediaUrl(null);
    onUploadSuccess(""); // Limpa a URL no formulário pai
  };

  return (
    <div className="space-y-2">
      <label className="font-medium">{label || "Arquivo"}</label>
      {mediaUrl ? (
        <div className="relative w-full h-48 border rounded-md overflow-hidden bg-black flex items-center justify-center">
          {isVideo(mediaUrl) ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 z-10"
            onClick={handleRemoveMedia}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className={cn(
          "relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-md",
          uploading && "cursor-not-allowed opacity-60"
        )}>
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Enviando...</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Arraste ou clique para enviar</p>
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
    </div>
  );
};