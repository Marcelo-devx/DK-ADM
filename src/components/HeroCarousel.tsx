import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "./ui/skeleton";
import { Link } from "react-router-dom";

const fetchActiveHeroSlides = async () => {
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const isVideo = (url: string) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg)$/i.test(url);
}

export const HeroCarousel = () => {
  const { data: slides, isLoading } = useQuery({
    queryKey: ["activeHeroSlides"],
    queryFn: fetchActiveHeroSlides,
  });

  if (isLoading) {
    return <Skeleton className="w-full h-64 md:h-96 rounded-lg" />;
  }

  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <Carousel className="w-full" opts={{ loop: true }}>
      <CarouselContent>
        {slides.map((slide) => {
          const slideContent = (
            <Card className="overflow-hidden">
              <CardContent className="relative flex aspect-video items-center justify-center p-0 bg-black">
                {slide.image_url && isVideo(slide.image_url) ? (
                    <video
                        src={slide.image_url}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
                ) : (
                    <img
                        src={slide.image_url || ''}
                        alt={slide.title || 'Hero slide'}
                        className="w-full h-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center text-center p-4 text-white">
                  {slide.title && <h2 className="text-4xl font-bold drop-shadow-md">{slide.title}</h2>}
                  {slide.subtitle && <p className="mt-2 text-xl drop-shadow-md">{slide.subtitle}</p>}
                </div>
              </CardContent>
            </Card>
          );

          return (
            <CarouselItem key={slide.id}>
              {slide.button_url ? (
                <Link to={slide.button_url} className="block cursor-pointer">
                  {slideContent}
                </Link>
              ) : (
                <div>{slideContent}</div>
              )}
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="absolute left-4" />
      <CarouselNext className="absolute right-4" />
    </Carousel>
  );
};