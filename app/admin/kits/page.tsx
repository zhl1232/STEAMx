import { requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { kitDatabase } from '@/lib/kits/service'
import { KitAdmin } from '@/components/kits/kit-admin'
export const dynamic='force-dynamic'
export default async function AdminKits(){await requireRole(await createClient(),['admin']);const {data,error}=await kitDatabase().from('experiment_kits').select('*').order('sort_order');if(error)throw error;const {data:relations,error:relationError}=await kitDatabase().from('experiment_kit_projects').select('kit_id,project_id,status,preparation_status,extras,evidence').order('sort_order').limit(10000);if(relationError)throw relationError;return <main className="mx-auto max-w-3xl p-6"><h1 className="mb-6 text-2xl font-semibold">套装与配套项目</h1><KitAdmin kits={data??[]} relations={relations??[]}/></main>}
