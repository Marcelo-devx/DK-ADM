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

export const InlineImageUploader = ({ cardId, initialUrl, onUploadSuccess }: InlineImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialUrl);

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
        onUploadSuccess(cardId, secure_url);
        showSuccess("Imagem atualizada com sucesso!");
      } catch (err: any) {
        console.error("Error uploading file:", err);
        showError(err.message || "Falha no upload do arquivo.");
      } finally {
        setUploading(false);
      }
    };
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