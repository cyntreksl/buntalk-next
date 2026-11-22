import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Accordion,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Pagination,
  ProductCardSkeleton,
  Skeleton,
  Spinner,
} from "@/components/ui";
import {
  ButtonLoadingDemo,
  DialogDemo,
  DrawerDemo,
  FormDemo,
  QuantityDemo,
  TabsDemo,
  ToastDemo,
} from "./demos";

export const metadata: Metadata = {
  title: "Components",
  robots: { index: false, follow: false },
};

const sections = [
  "button",
  "form",
  "card",
  "badge",
  "dialog",
  "drawer",
  "toast",
  "tabs",
  "accordion",
  "loading",
  "pagination",
  "breadcrumb",
  "quantity",
];

function Demo({
  id,
  title,
  description,
  code,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  code: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        <p className="text-muted-foreground max-w-prose">{description}</p>
      </div>
      <Card padding="lg">{children}</Card>
      <details className="group">
        <summary className="text-body-sm text-primary cursor-pointer font-bold">Show code</summary>
        <pre className="border-border bg-surface-muted text-body-sm mt-2 overflow-x-auto rounded-md border p-4">
          <code>{code.trim()}</code>
        </pre>
      </details>
    </section>
  );
}

export default function ComponentsPage() {
  return (
    <div className="max-w-page mx-auto flex w-full flex-col gap-14 px-4 py-10 md:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <Breadcrumb
          items={[{ label: "Style guide", href: "/style-guide" }, { label: "Components" }]}
        />
        <h1 className="text-display">Components</h1>
        <p className="text-body-lg text-muted-foreground max-w-prose">
          Shared UI components from <code className="font-mono">components/ui</code>. Import them
          with{" "}
          <code className="font-mono">import {"{ Button }"} from &quot;@/components/ui&quot;</code>.
          All of them use the design tokens, work with the keyboard and are labelled for screen
          readers.
        </p>
        <nav aria-label="Components" className="text-body-sm flex flex-wrap gap-x-4 gap-y-1">
          {sections.map((id) => (
            <a key={id} href={`#${id}`} className="text-primary capitalize underline">
              {id}
            </a>
          ))}
        </nav>
      </header>

      <Demo
        id="button"
        title="Button"
        description={
          <>
            Five variants and three sizes. <code>loading</code> shows a spinner and disables the
            button. To make a link look like a button use <code>buttonClasses()</code>.
          </>
        }
        code={`
<Button>Add to cart</Button>
<Button variant="secondary" size="sm">Save</Button>
<Button variant="danger">Delete</Button>
<Button loading>Saving…</Button>
<Button disabled>Sold out</Button>
<Link href="/cart" className={buttonClasses({ variant: "outline" })}>View cart</Link>`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLoadingDemo />
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled outline
            </Button>
          </div>
        </div>
      </Demo>

      <Demo
        id="form"
        title="Form fields"
        description={
          <>
            <code>FormField</code> wraps <code>Input</code>, <code>Select</code> or{" "}
            <code>Textarea</code> and connects the label, hint and error message. Errors are
            announced to screen readers and the control is marked invalid. <code>Checkbox</code> and{" "}
            <code>Radio</code> carry their own label; group radios in <code>RadioGroup</code>.
            Submit the empty form to see the error states.
          </>
        }
        code={`
<FormField label="Email" hint="We'll send your receipt here." error={errors.email} required>
  <Input name="email" type="email" />
</FormField>

<FormField label="City" error={errors.city}>
  <Select
    name="city"
    placeholder="Choose a city"
    options={[{ value: "colombo", label: "Colombo" }, { value: "kandy", label: "Kandy" }]}
  />
</FormField>

<FormField label="Delivery notes"><Textarea name="notes" /></FormField>

<RadioGroup legend="Delivery" error={errors.delivery}>
  <Radio name="delivery" value="standard" label="Standard" description="2–3 days" />
</RadioGroup>

<Checkbox name="terms" label="I accept the terms" error={errors.terms} />`}
      >
        <FormDemo />
      </Demo>

      <Demo
        id="card"
        title="Card"
        description={
          <>
            Groups content. <code>interactive</code> adds a hover lift for clickable cards. Padding:{" "}
            <code>none</code>, <code>sm</code>, <code>md</code>, <code>lg</code>.
          </>
        }
        code={`
<Card>
  <CardTitle>Order #1024</CardTitle>
  <CardDescription>Placed on 21 Nov</CardDescription>
</Card>
<Card interactive>…</Card>`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Order #1024</CardTitle>
            <CardDescription>Placed on 21 November · 3 items</CardDescription>
          </Card>
          <Card interactive className="relative">
            <CardTitle>
              <Link href="/style-guide/components#card" className="after:absolute after:inset-0">
                Interactive card
              </Link>
            </CardTitle>
            <CardDescription>The whole card is one link.</CardDescription>
          </Card>
        </div>
      </Demo>

      <Demo
        id="badge"
        title="Badge"
        description="Short status labels. The text must carry the meaning, not just the colour."
        code={`<Badge tone="brand">New</Badge>
<Badge tone="success">Paid</Badge>
<Badge tone="danger">Sold out</Badge>`}
      >
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="brand">New</Badge>
          <Badge tone="success">Paid</Badge>
          <Badge tone="warning">Only 2 left</Badge>
          <Badge tone="danger">Sold out</Badge>
          <Badge tone="info">Pre-order</Badge>
        </div>
      </Demo>

      <Demo
        id="dialog"
        title="Dialog"
        description="Modal built on the native <dialog>: focus stays inside, Esc and clicking outside close it, and focus returns to the button that opened it."
        code={`
const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Remove</Button>
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Remove item?"
  description="This removes the item from your cart."
  footer={<Button variant="danger" onClick={remove}>Remove</Button>}
/>`}
      >
        <DialogDemo />
      </Demo>

      <Demo
        id="drawer"
        title="Drawer"
        description="Slides in from the right, left or bottom. Same keyboard behaviour as the dialog."
        code={`
<Drawer open={open} onClose={close} side="right" title="Your cart" footer={<Button fullWidth>Checkout</Button>}>
  …
</Drawer>`}
      >
        <DrawerDemo />
      </Demo>

      <Demo
        id="toast"
        title="Toast"
        description="Short messages in the corner. Success and info close after 5 seconds; errors stay until dismissed. Announced to screen readers."
        code={`
import { toast } from "@/components/ui";

toast.success("Added to cart", "1 × Sample Product 1");
toast.error("Payment failed", "Please try another card.");`}
      >
        <ToastDemo />
      </Demo>

      <Demo
        id="tabs"
        title="Tabs"
        description="Arrow keys move between tabs, Home/End jump to the ends. Disabled tabs are skipped."
        code={`
<Tabs
  label="Product information"
  items={[
    { id: "description", label: "Description", content: <p>…</p> },
    { id: "reviews", label: "Reviews", content: <p>…</p> },
  ]}
/>`}
      >
        <TabsDemo />
      </Demo>

      <Demo
        id="accordion"
        title="Accordion"
        description={
          <>
            Built on native <code>&lt;details&gt;</code>, so it works without JavaScript.{" "}
            <code>single</code> allows only one open section at a time.
          </>
        }
        code={`
<Accordion
  single
  items={[
    { id: "delivery", title: "How long does delivery take?", content: "…", defaultOpen: true },
    { id: "returns", title: "Can I return an order?", content: "…" },
  ]}
/>`}
      >
        <Accordion
          single
          items={[
            {
              id: "delivery",
              title: "How long does delivery take?",
              content: "Standard delivery takes 2–3 working days within Colombo.",
              defaultOpen: true,
            },
            {
              id: "returns",
              title: "Can I return an order?",
              content:
                "Fresh food can't be returned, but tell us within 24 hours if something is wrong.",
            },
            {
              id: "payment",
              title: "Which payment methods do you accept?",
              content: "Cards and cash on delivery.",
            },
          ]}
        />
      </Demo>

      <Demo
        id="loading"
        title="Spinner and skeleton"
        description="Spinner for short waits and inside buttons. Skeletons hold the layout while content loads; label the area with role=status and a hidden message."
        code={`
<Spinner />                     // announces "Loading"
<Spinner size="lg" label="Loading orders" />
<Skeleton className="h-6 w-40" />
<ProductCardSkeleton />`}
      >
        <div className="flex flex-col gap-6">
          <div className="text-primary flex items-center gap-6">
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
          </div>
          <div role="status" className="grid gap-4 sm:grid-cols-3">
            <span className="sr-only">Loading products…</span>
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </Demo>

      <Demo
        id="pagination"
        title="Pagination"
        description={
          <>
            Real links (<code>?page=N</code>), so it works without JavaScript and search engines can
            follow it. Long ranges collapse with “…”.
          </>
        }
        code={`<Pagination page={5} totalPages={20} basePath="/category/buns" />`}
      >
        <div className="flex flex-col gap-4">
          <Pagination page={1} totalPages={4} basePath="/style-guide/components" />
          <Pagination page={5} totalPages={20} basePath="/style-guide/components" />
        </div>
      </Demo>

      <Demo
        id="breadcrumb"
        title="Breadcrumb"
        description="Shows where the page sits. The last item is marked as the current page."
        code={`
<Breadcrumb items={[
  { label: "Home", href: "/" },
  { label: "Buns", href: "/category/buns" },
  { label: "Fish bun" },
]} />`}
      >
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Buns", href: "/style-guide/components#breadcrumb" },
            { label: "Fish bun" },
          ]}
        />
      </Demo>

      <Demo
        id="quantity"
        title="Quantity stepper"
        description="− / + buttons with a typed value, kept within min and max. The buttons disable at the limits."
        code={`<QuantityStepper value={qty} onChange={setQty} min={1} max={10} label="Quantity of Fish bun" />`}
      >
        <QuantityDemo />
      </Demo>
    </div>
  );
}
