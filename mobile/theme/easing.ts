import { Easing } from "react-native";

/** Surfaces arrive gently and leave more quickly. */
export const EASE_ENTER = Easing.out(Easing.cubic);
export const EASE_EXIT = Easing.in(Easing.cubic);
