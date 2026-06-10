# Study App Logo

Logo minimalista: três bolinhas (duas azuis + uma verde) + texto "Study".

## Arquivos

| Arquivo | Conteúdo | Uso |
|---------|----------|-----|
| `logo-icon.svg` | Só as bolinhas | **Favicon** e ícone de app |
| `logo-full.svg` | Bolinhas + "Study" | Header, materiais de marca |
| `logo.svg` | Igual ao full | Referência / OG |
| `logo.tsx` | Componente React | Uso inline no app |

## Favicon

Configurado em `src/routes/__root/-index.tsx`:

```ts
{ rel: "icon", type: "image/svg+xml", href: "/logo-icon.svg" }
```

## Componente React

```tsx
import { Logo } from "@/components/logo";

<Logo variant="full" />   // bolinhas + Study (nav)
<Logo variant="icon" />   // só bolinhas
```

## Dark mode

SVGs estáticos usam `prefers-color-scheme`. O componente React segue o tema do app via Tailwind (`dark:`).
