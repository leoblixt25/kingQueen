
import { cn } from "@/lib/utils";
import { Gender } from "@/types";

interface GenderButtonProps {
  gender: Gender;
  selected: boolean;
  onClick: () => void;
}

const GenderButton = ({ gender, selected, onClick }: GenderButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 transform hover:scale-105",
        "shadow-sm hover:shadow-md active:scale-95",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
      )}
    >
      {gender === "male" ? "Male" : "Female"}
    </button>
  );
};

export default GenderButton;
