"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  Drawer,
  FormField,
  Input,
  QuantityStepper,
  Radio,
  RadioGroup,
  Select,
  Tabs,
  Textarea,
  toast,
} from "@/components/ui";

/** Interactive examples for the component demo page. */

export function ButtonLoadingDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 2000);
      }}
    >
      {loading ? "Saving…" : "Click to load"}
    </Button>
  );
}

export function FormDemo() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    if (!String(data.get("name") ?? "").trim()) next.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(String(data.get("email") ?? "")))
      next.email = "Please enter a valid email address.";
    if (!data.get("city")) next.city = "Please choose a city.";
    if (!data.get("delivery")) next.delivery = "Please choose a delivery option.";
    if (!data.get("terms")) next.terms = "You need to accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Details saved", "This is a demo, nothing was sent.");
    }, 1200);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 md:grid-cols-2">
      <FormField label="Full name" error={errors.name} required>
        <Input name="name" autoComplete="name" />
      </FormField>
      <FormField label="Email" hint="We'll send your receipt here." error={errors.email} required>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="City" error={errors.city} required>
        <Select name="city" defaultValue="" placeholder="Choose a city">
          <option value="colombo">Colombo</option>
          <option value="kandy">Kandy</option>
          <option value="galle">Galle</option>
        </Select>
      </FormField>
      <FormField label="Phone (disabled)">
        <Input name="phone" disabled placeholder="Not available yet" />
      </FormField>
      <FormField label="Delivery notes" hint="Optional" className="md:col-span-2">
        <Textarea name="notes" placeholder="Gate code, landmarks…" />
      </FormField>
      <RadioGroup legend="Delivery" error={errors.delivery} required>
        <Radio name="delivery" value="standard" label="Standard" description="2–3 days, free" />
        <Radio name="delivery" value="express" label="Express" description="Next day, LKR 350" />
        <Radio
          name="delivery"
          value="pickup"
          label="Store pickup"
          description="Unavailable"
          disabled
        />
      </RadioGroup>
      <div className="flex flex-col gap-3">
        <Checkbox name="news" label="Send me offers" description="About once a month." />
        <Checkbox name="terms" label="I accept the terms and conditions" error={errors.terms} />
        <Checkbox name="locked" label="Disabled checkbox" disabled />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" loading={submitting}>
          Save details
        </Button>
      </div>
    </form>
  );
}

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Remove item?"
        description="This removes Sample Product 1 from your cart."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                toast.info("Item removed");
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}

export function DrawerDemo() {
  const [side, setSide] = useState<"right" | "left" | "bottom" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setSide("right")}>
        Right drawer
      </Button>
      <Button variant="outline" onClick={() => setSide("left")}>
        Left drawer
      </Button>
      <Button variant="outline" onClick={() => setSide("bottom")}>
        Bottom sheet
      </Button>
      <Drawer
        open={side !== null}
        side={side ?? "right"}
        onClose={() => setSide(null)}
        title="Your cart"
        description="2 items"
        footer={
          <Button fullWidth onClick={() => setSide(null)}>
            Go to checkout
          </Button>
        }
      >
        <p className="text-muted-foreground">
          Drawers are good for the cart, filters and the mobile menu. Press Esc or click outside to
          close.
        </p>
      </Drawer>
    </div>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toast.success("Added to cart", "1 × Sample Product 1")}
      >
        Success toast
      </Button>
      <Button variant="outline" onClick={() => toast.info("Delivery tomorrow")}>
        Info toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Payment failed", "Please try another card.")}
      >
        Error toast
      </Button>
    </div>
  );
}

export function TabsDemo() {
  return (
    <Tabs
      label="Product information"
      items={[
        {
          id: "description",
          label: "Description",
          content: <p>Soft, freshly baked every morning.</p>,
        },
        {
          id: "ingredients",
          label: "Ingredients",
          content: <p>Flour, butter, sugar, yeast, salt.</p>,
        },
        { id: "reviews", label: "Reviews", content: <p>No reviews yet.</p> },
        { id: "nutrition", label: "Nutrition", content: null, disabled: true },
      ]}
    />
  );
}

export function QuantityDemo() {
  const [value, setValue] = useState(2);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <QuantityStepper value={value} onChange={setValue} min={1} max={10} />
      <QuantityStepper value={value} onChange={setValue} size="sm" />
      <QuantityStepper value={1} onChange={() => {}} disabled label="Disabled quantity" />
      <span className="text-body-sm text-muted-foreground">Value: {value} (1–10)</span>
    </div>
  );
}
