import { useRef, useState } from "react";
import { RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCopy } from "@/lib/locale";
import { ProviderIcons, type ProviderIconType } from "@/lib/constants/icons";
import { displayProvider, ProviderMark, saveProviderAppearance, useProviderAppearance } from "@/components/registry/BrandIcon";

const MAX_BYTES = 256 * 1024;
const MAX_DIMENSION = 512;
const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function providerImageFileError(file: Pick<File, "type" | "size">): string | undefined {
  if (!acceptedTypes.has(file.type)) return "unsupported-type";
  if (file.size > MAX_BYTES) return "file-too-large";
}

async function readProviderImage(file: File, copy: (english: string, french: string) => string): Promise<string> {
  const fileError = providerImageFileError(file);
  if (fileError === "unsupported-type") throw new Error(copy("Choose a PNG, JPEG, or WebP image.", "Choisissez une image PNG, JPEG ou WebP."));
  if (fileError === "file-too-large") throw new Error(copy("The file must be 256 KB or smaller.", "Le fichier doit faire 256 Ko maximum."));
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) throw new Error(copy("The image must be at most 512 × 512 pixels.", "L’image doit mesurer 512 × 512 pixels maximum."));
  } finally { bitmap.close(); }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(copy("Could not read this image.", "Impossible de lire ce fichier image.")));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(copy("This image file could not be read.", "Fichier image illisible.")));
    reader.readAsDataURL(file);
  });
}

function ProviderRow({ provider }: { provider: string }) {
  const copy = useCopy();
  const appearance = useProviderAppearance(provider);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentIcon = appearance?.icon || "";
  const name = displayProvider(provider);
  const errorMessage = (cause: unknown) => cause instanceof Error && cause.message === "provider-appearance-storage"
    ? copy("Could not save this browser preference. Check local storage space and permissions.", "Impossible d’enregistrer cette préférence. Vérifiez l’espace et les permissions du stockage local.")
    : cause instanceof Error ? cause.message : copy("Could not save this browser preference.", "Impossible d’enregistrer cette préférence dans ce navigateur.");
  const changeIcon = (icon: string) => {
    setError("");
    if (icon === "__image") return;
    if (icon === "__default") icon = "";
    try { saveProviderAppearance(provider, icon ? { icon: icon as ProviderIconType } : undefined); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  return <section className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-sm border bg-card p-3 @min-[44rem]/appearance:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_auto_auto]">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border bg-background [&>span]:scale-150"><ProviderMark id={provider} /></span>
      <div className="min-w-0"><h3 className="break-words text-sm font-medium">{name}</h3>{name.toLocaleLowerCase() !== provider.toLocaleLowerCase() && <p className="truncate text-xs text-muted-foreground">{provider}</p>}</div>
    </div>
    <label className="col-span-2 grid min-w-0 gap-1 text-sm @min-[44rem]/appearance:col-span-1">
      <span>{copy("Existing logo", "Logo existant")}</span>
      <Select value={appearance?.image ? "__image" : currentIcon || "__default"} onValueChange={changeIcon}>
        <SelectTrigger className="min-w-0 w-full [&>span]:min-w-0 [&>span]:truncate" aria-label={copy("Existing logo", "Logo existant")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
          <SelectItem value="__default">{copy("Provider default", "Logo fournisseur par défaut")}</SelectItem>
          {appearance?.image && <SelectItem value="__image">{copy("Uploaded image", "Image importée")}</SelectItem>}
          {Object.keys(ProviderIcons).map(icon => <SelectItem key={icon} value={icon}>{icon.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
    <div className="col-span-2 flex min-w-0 items-center gap-2 @min-[44rem]/appearance:col-span-1 @min-[44rem]/appearance:self-end">
      <Input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} tabIndex={-1} aria-label={copy("Choose a provider logo image", "Choisir une image de logo fournisseur")} aria-describedby="provider-upload-hint" onChange={async event => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setBusy(true); setError("");
        try { saveProviderAppearance(provider, { image: await readProviderImage(file, copy) }); }
        catch (cause) { setError(cause instanceof Error ? cause.message : copy("Could not use this image.", "Impossible d’utiliser cette image.")); }
        finally { setBusy(false); input.value = ""; }
      }} />
      <Button type="button" variant="outline" className="min-w-0" disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="size-4" />{busy ? copy("Reading…", "Lecture…") : copy("Choose image", "Choisir une image")}</Button>
    </div>
    <Button type="button" variant="ghost" className="col-start-2 row-start-1 self-end @min-[44rem]/appearance:col-start-auto @min-[44rem]/appearance:row-start-auto" disabled={!appearance} aria-label={copy(`Reset ${name} logo`, `Réinitialiser le logo ${name}`)} onClick={() => { try { saveProviderAppearance(provider); setError(""); } catch (cause) { setError(errorMessage(cause)); } }}><RotateCcw className="size-4" /><span className="hidden sm:inline">{copy("Reset", "Réinitialiser")}</span></Button>
    {error && <p role="alert" className="col-span-2 text-sm text-destructive @min-[44rem]/appearance:col-span-4">{error}</p>}
  </section>;
}

export function ProviderAppearance({ providers }: { providers: string[] }) {
  const copy = useCopy();
  const uniqueProviders = [...new Set(providers.filter(Boolean))].sort((a, b) => displayProvider(a).localeCompare(displayProvider(b)));
  return <section className="flex flex-col gap-3">
    <header><h2 className="text-lg font-semibold">{copy("Provider logos", "Logos des fournisseurs")}</h2><p className="mt-1 max-w-prose text-sm text-muted-foreground">{copy("Choose an existing logo or upload a small image. This changes only how the provider is shown in this browser; it does not change the model creator or provider identity.", "Choisissez un logo existant ou importez une petite image. Cela change uniquement l’affichage du fournisseur dans ce navigateur, sans modifier l’identité du créateur ni du fournisseur.")}</p></header>
    <p id="provider-upload-hint" className="rounded-sm border bg-muted/30 p-2.5 text-sm text-muted-foreground">{copy("Saved locally in this browser. No image URL is sent to a server. PNG, JPEG, or WebP · 256 KB · up to 512 × 512 px.", "Enregistré localement dans ce navigateur. Aucune URL d’image n’est envoyée à un serveur. PNG, JPEG ou WebP · 256 Ko · 512 × 512 px maximum.")}</p>
    <div className="@container/appearance flex flex-col gap-2">{uniqueProviders.map(provider => <ProviderRow key={provider} provider={provider} />)}{!uniqueProviders.length && <p className="rounded-sm border border-dashed p-5 text-sm text-muted-foreground">{copy("No providers are available yet.", "Aucun fournisseur n’est disponible pour le moment.")}</p>}</div>
  </section>;
}
