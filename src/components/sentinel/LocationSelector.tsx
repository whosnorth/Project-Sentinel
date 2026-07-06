import * as React from "react";
import { Check, ChevronsUpDown, Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CountryWeight, LocationSelection, REGIONS } from "./LocationTypes";

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Senegal" },
  { code: "KE", name: "Kenya" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "DE", name: "Germany" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "RU", name: "Russia" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "AU", name: "Australia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "UAE" },
  { code: "IL", name: "Israel" },
  { code: "IR", name: "Iran" },
  { code: "TR", name: "Turkey" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "SG", name: "Singapore" },
].sort((a, b) => a.name.localeCompare(b.name));

type Props = {
  value: LocationSelection;
  onChange: (value: LocationSelection) => void;
};

export function LocationSelector({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  const getDisplayLabel = () => {
    if (value.type === "global") return "GLOBAL";
    if (value.type === "region") return value.name.toUpperCase();
    if (value.type === "country") return value.name.toUpperCase();
    return "SELECT LOCATION";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-7 w-[200px] justify-between border-[#1a2332] bg-[#0d1117]/80 px-3 py-1 font-mono text-[10px] tracking-widest text-zinc-400 hover:bg-[#0d1117] hover:text-zinc-300",
            value.type !== "global" && "border-amber-500/50 bg-amber-500/10 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {value.type === "global" ? (
              <Globe className="h-3 w-3" />
            ) : (
              <MapPin className="h-3 w-3" />
            )}
            <span className="truncate">{getDisplayLabel()}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] border-[#1a2332] bg-[#0d1117] p-0 font-mono">
        <Command className="bg-transparent">
          <CommandInput 
            placeholder="Search country or region..." 
            className="h-9 text-xs placeholder:text-zinc-600 text-zinc-300"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-4 text-center text-xs text-zinc-500">No location found.</CommandEmpty>
            
            <CommandGroup heading="Global">
              <CommandItem
                onSelect={() => {
                  onChange({ type: "global" });
                  setOpen(false);
                }}
                className="text-xs text-zinc-400 aria-selected:bg-[#1a2332] aria-selected:text-zinc-200"
              >
                <Check
                  className={cn(
                    "mr-2 h-3 w-3 text-amber-500",
                    value.type === "global" ? "opacity-100" : "opacity-0"
                  )}
                />
                Global View
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Regions">
              {REGIONS.map((region) => (
                <CommandItem
                  key={region.name}
                  value={region.name}
                  onSelect={() => {
                    onChange({ type: "region", name: region.name, countries: region.countries });
                    setOpen(false);
                  }}
                  className="text-xs text-zinc-400 aria-selected:bg-[#1a2332] aria-selected:text-zinc-200"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3 text-amber-500",
                      value.type === "region" && value.name === region.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {region.name}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Countries">
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.name}
                  onSelect={() => {
                    onChange({ type: "country", code: country.code, name: country.name });
                    setOpen(false);
                  }}
                  className="text-xs text-zinc-400 aria-selected:bg-[#1a2332] aria-selected:text-zinc-200"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3 text-amber-500",
                      value.type === "country" && value.code === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {country.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
