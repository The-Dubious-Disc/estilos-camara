import { PhotoLab } from "@/components/photo-lab";
import { caveat } from "@/lib/fonts";

export default function Home() {
  return <PhotoLab handFont={caveat.style.fontFamily} />;
}
