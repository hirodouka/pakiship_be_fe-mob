/// <reference types="nativewind/types" />

import "react-native";
import { LucideProps } from "lucide-react-native";

declare module "lucide-react-native" {
  interface LucideProps {
    className?: string;
  }
}

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
}
