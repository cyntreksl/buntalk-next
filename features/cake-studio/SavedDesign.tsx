import { connection } from "next/server";
import { Card } from "@/components/ui";
import { getCustomerId } from "@/lib/auth";
import {
  ErpNotFoundError,
  ErpValidationError,
  getCakeDesign,
  type SavedCakeDesign,
} from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

const CURRENCY = "LKR";

type Loaded =
  | { design: SavedCakeDesign }
  | { problem: "not_found" }
  | { problem: "unavailable_options"; reason: string };

async function load(id: string): Promise<Loaded> {
  try {
    return { design: await getCakeDesign(id, { customerId: await getCustomerId() }) };
  } catch (error) {
    if (error instanceof ErpNotFoundError) return { problem: "not_found" };
    if (error instanceof ErpValidationError) {
      return { problem: "unavailable_options", reason: error.userMessage };
    }
    throw error;
  }
}

/**
 * A saved Cake Studio design opened by its id (`/cake-studio?design={id}`,
 * BUN-179). The ERP prices it again with today's menu and prices, so the
 * price shown is always current.
 */
export async function SavedDesign({
  searchParams,
}: {
  searchParams: Promise<{ design?: string | string[] }>;
}) {
  const raw = (await searchParams).design;
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  // A live ERP read for one visitor: only at request time, never while prerendering.
  await connection();
  const loaded = await load(id);

  return (
    <Card className="flex flex-col gap-4" aria-labelledby="saved-design">
      <div className="flex flex-col gap-1">
        <h2 id="saved-design" className="text-h3">
          Your saved design
        </h2>
        <p className="text-body-sm text-muted-foreground">Design code: {id}</p>
      </div>

      {"problem" in loaded ? (
        <p role="status">
          {loaded.problem === "not_found"
            ? "We couldn't find a saved cake design with that code."
            : `This design can't be made any more: ${loaded.reason} Please design it again.`}
        </p>
      ) : (
        <>
          <dl className="divide-border divide-y">
            {loaded.design.summary.map((row) => (
              <div key={row.label} className="grid gap-1 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-body-sm text-muted-foreground font-bold">{row.label}</dt>
                <dd className="text-body-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-body-sm font-bold">Today&apos;s price</h3>
            <ul className="flex flex-col gap-1">
              {loaded.design.lines.map((line) => (
                <li key={line.label} className="text-body-sm flex justify-between gap-4">
                  <span>{line.label}</span>
                  <span>{formatPrice(line.price, CURRENCY)}</span>
                </li>
              ))}
            </ul>
            <p className="border-border text-body-lg flex justify-between gap-4 border-t pt-2 font-bold">
              <span>Total</span>
              <span>{formatPrice(loaded.design.total, CURRENCY)}</span>
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
