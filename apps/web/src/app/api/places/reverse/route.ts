/**
 * Reverse geocode — coordenadas → cidade/estado/bairro/endereço.
 * Usado quando o user vai cadastrar um lugar novo manualmente: a gente
 * recebe a lat/lng do GPS, e usa Nominatim pra preencher cidade/estado
 * (necessário pelo RLS do `gyms` que exige city >= 2 chars).
 */

import { NextResponse } from "next/server";

type NominatimReverse = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    state_code?: string;
    country_code?: string;
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
    addressdetails: "1",
    "accept-language": "pt-BR",
    zoom: "18", // street-level detail
  });

  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent":
          "GymCircle/1.0 (https://gym-circle-rust.vercel.app; contact: dudy.cappia@gmail.com)",
        "Accept-Language": "pt-BR",
      },
      next: { revalidate: 600 }, // 10min — coords idênticas viram a mesma resposta
    });
  } catch {
    return NextResponse.json(
      { error: "Não conseguimos contatar o serviço de geocoding." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Serviço de geocoding indisponível." },
      { status: response.status },
    );
  }

  let data: NominatimReverse;
  try {
    data = (await response.json()) as NominatimReverse;
  } catch {
    return NextResponse.json(
      { error: "Resposta inválida do geocoding." },
      { status: 502 },
    );
  }

  const address = data.address ?? {};
  const result = {
    address: [address.road, address.house_number].filter(Boolean).join(", "),
    neighborhood: address.suburb ?? address.neighbourhood ?? address.city_district ?? null,
    city:
      address.city ??
      address.town ??
      address.municipality ??
      address.city_district ??
      "",
    state: address.state ?? address.state_code ?? null,
    displayName: data.display_name ?? "",
  };

  return NextResponse.json(result);
}
