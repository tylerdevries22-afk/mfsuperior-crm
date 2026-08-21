import { NEW_LOAD_FORM } from "@/features/freight-screen-specs";
import { FreightFormScreen } from "@/route-support/freight";

export default function NewLoadScreen() {
  return <FreightFormScreen spec={NEW_LOAD_FORM} />;
}
