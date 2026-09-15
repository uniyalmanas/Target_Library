import { supabase } from "@/lib/supabase";

export interface StoredExpense {
  id: string;
  library_id: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  expense_date: string;
  notes?: string | null;
  created_at: string;
}

// In-memory cache to guarantee ultra-fast response and zero file-system dependencies in serverless
const memoryCache: Record<string, StoredExpense[]> = {};

export function getSysSlug(slug: string = "target-library"): string {
  return `sys-expenses-${slug}`;
}

/**
 * Fetch persistent expenses for a given slug.
 * Checks:
 * 1. Native `expenses` table in Supabase (if migrated).
 * 2. Cloud-backed Supabase system record `sys-expenses-${slug}`.
 * 3. In-memory cache.
 */
export async function getPersistentExpenses(slug: string = "target-library", libraryId?: string): Promise<StoredExpense[]> {
  // 1. Try native Supabase expenses table
  if (libraryId) {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("library_id", libraryId)
        .order("expense_date", { ascending: false });

      if (!error && data) {
        memoryCache[slug] = data as StoredExpense[];
        return data as StoredExpense[];
      }
    } catch {
      // Native table not present
    }
  }

  // 2. Query cloud-backed Supabase system record
  const sysSlug = getSysSlug(slug);
  try {
    const { data, error } = await supabase
      .from("libraries")
      .select("address")
      .eq("slug", sysSlug)
      .maybeSingle();

    if (!error && data && data.address) {
      const parsed = JSON.parse(data.address);
      if (Array.isArray(parsed)) {
        memoryCache[slug] = parsed as StoredExpense[];
        return parsed as StoredExpense[];
      }
    }
  } catch (err) {
    console.warn("Notice: cloud expenses query returned fallback:", err);
  }

  // 3. Fallback to memory cache if present
  if (memoryCache[slug]) {
    return memoryCache[slug];
  }

  return [];
}

/**
 * Save new expense persistently to Supabase cloud
 */
export async function addPersistentExpense(
  slug: string = "target-library",
  libraryId: string,
  item: Omit<StoredExpense, "id" | "created_at">
): Promise<StoredExpense> {
  const newRecord: StoredExpense = {
    ...item,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  // 1. Try native Supabase expenses table
  try {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        ...item,
        library_id: libraryId,
      })
      .select()
      .single();

    if (!error && data) {
      const current = memoryCache[slug] || [];
      memoryCache[slug] = [data as StoredExpense, ...current];
      return data as StoredExpense;
    }
  } catch {
    // Native table not present
  }

  // 2. Save into cloud-backed Supabase system record
  const sysSlug = getSysSlug(slug);
  const current = await getPersistentExpenses(slug, libraryId);
  const updated = [newRecord, ...current.filter((e) => e.id !== newRecord.id)];
  memoryCache[slug] = updated;

  try {
    await supabase
      .from("libraries")
      .upsert(
        {
          slug: sysSlug,
          name: `System Expenses Store for ${slug}`,
          address: JSON.stringify(updated),
          city: "Dehradun",
          monthly_fee: 0,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );
  } catch (err) {
    console.error("Failed to upsert cloud expense:", err);
  }

  return newRecord;
}

/**
 * Update an existing expense persistently
 */
export async function updatePersistentExpense(
  slug: string = "target-library",
  libraryId: string,
  id: string,
  updates: Partial<Omit<StoredExpense, "id" | "created_at" | "library_id">>
): Promise<StoredExpense | null> {
  // 1. Try native Supabase expenses table
  try {
    const { data, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const current = memoryCache[slug] || [];
      memoryCache[slug] = current.map((e) => (e.id === id ? (data as StoredExpense) : e));
      return data as StoredExpense;
    }
  } catch {
    // Native table not present
  }

  // 2. Update cloud-backed Supabase system record
  const sysSlug = getSysSlug(slug);
  const current = await getPersistentExpenses(slug, libraryId);
  let updatedRecord: StoredExpense | null = null;
  const updated = current.map((e) => {
    if (e.id === id) {
      updatedRecord = { ...e, ...updates };
      return updatedRecord;
    }
    return e;
  });

  memoryCache[slug] = updated;

  if (updatedRecord) {
    try {
      await supabase
        .from("libraries")
        .upsert(
          {
            slug: sysSlug,
            name: `System Expenses Store for ${slug}`,
            address: JSON.stringify(updated),
            city: "Dehradun",
            monthly_fee: 0,
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        );
    } catch (err) {
      console.error("Failed to update cloud expense:", err);
    }
  }

  return updatedRecord;
}

/**
 * Delete an expense persistently from cloud database
 */
export async function deletePersistentExpense(
  slug: string = "target-library",
  libraryId: string,
  id: string
): Promise<boolean> {
  // 1. Try native Supabase expenses table
  try {
    await supabase.from("expenses").delete().eq("id", id);
  } catch {
    // ignore
  }

  // 2. Remove from cloud-backed Supabase system record
  const sysSlug = getSysSlug(slug);
  const current = await getPersistentExpenses(slug, libraryId);
  const filtered = current.filter((e) => e.id !== id);
  memoryCache[slug] = filtered;

  try {
    const { error } = await supabase
      .from("libraries")
      .upsert(
        {
          slug: sysSlug,
          name: `System Expenses Store for ${slug}`,
          address: JSON.stringify(filtered),
          city: "Dehradun",
          monthly_fee: 0,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );
    return !error;
  } catch (err) {
    console.error("Failed to delete cloud expense:", err);
    return true;
  }
}

// Backward-compatible sync aliases for legacy imports
export function getLocalExpenses(libraryId: string): StoredExpense[] {
  return memoryCache["target-library"] || [];
}

export function addLocalExpense(item: Omit<StoredExpense, "id" | "created_at">): StoredExpense {
  const newRecord: StoredExpense = {
    ...item,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  const list = memoryCache["target-library"] || [];
  memoryCache["target-library"] = [newRecord, ...list];
  return newRecord;
}

export function deleteLocalExpense(id: string): boolean {
  const list = memoryCache["target-library"] || [];
  memoryCache["target-library"] = list.filter((e) => e.id !== id);
  return true;
}
