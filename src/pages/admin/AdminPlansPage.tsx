import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Pencil, X } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { AdminShell } from '../../components/admin/AdminShell'
import type { AdminPlan } from '../../types/admin'

function PlanBadge({ tier }: { tier: string }) {
  const variant = tier === 'Pro' ? 'plan-pro' : tier === 'Unlimited' ? 'plan-unlimited' : ('plan-free' as const)
  return <Badge variant={variant}>{tier}</Badge>
}

function EditPlanModal({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(plan.name)
  const [description, setDescription] = useState(plan.description)
  const [price, setPrice] = useState(String(plan.price))
  const [isActive, setIsActive] = useState(plan.isActive)

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.updatePlan(plan.id, {
        name,
        description,
        price: Number(price),
        isActive,
      }),
    onSuccess: () => {
      toast.success('Plan updated. Existing subscriptions are unaffected.')
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
      onClose()
    },
    onError: () => toast.error('Failed to update plan.'),
  })

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${plan.name} (${plan.billingInterval})`} size="sm">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Price ({plan.currency})</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted mt-1">
            Changes future checkouts only — existing subscriptions keep the price they were purchased at.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-main">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (purchasable)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-text-main">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function AdminPlansPage() {
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminApi.getAdminPlans().then((r) => r.data),
  })

  const { data: matrix } = useQuery({
    queryKey: ['admin-entitlements'],
    queryFn: () => adminApi.getEntitlementMatrix().then((r) => r.data),
  })

  const plansTiers = ['Free', 'Pro', 'Unlimited']
  const features = Array.from(new Set(matrix?.map((m) => m.feature) ?? []))

  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-base font-semibold text-text-main mb-3">Plans</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02]">
                    {['Tier', 'Name', 'Interval', 'Price', 'Active', 'Features', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${50 + j * 6}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    (plans ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <PlanBadge tier={p.tier} />
                        </td>
                        <td className="px-4 py-3 text-sm text-text-main">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-muted">{p.billingInterval}</td>
                        <td className="px-4 py-3 text-sm text-text-main">
                          {p.currency} {p.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.isActive ? 'success' : 'error'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">{p.features.length}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingPlan(p)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-main mb-1">Feature entitlements</h2>
          <p className="text-xs text-muted mb-3">
            Read-only — the canonical Plan → Feature mapping used by the application (EntitlementService).
          </p>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Feature</th>
                  {plansTiers.map((tier) => (
                    <th key={tier} className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <tr key={feature} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-3 text-sm text-text-main">{feature}</td>
                    {plansTiers.map((tier) => {
                      const entry = matrix?.find((m) => m.plan === tier && m.feature === feature)
                      return (
                        <td key={tier} className="px-4 py-3 text-center">
                          {entry?.hasAccess ? (
                            <Check size={14} className="inline text-emerald-400" />
                          ) : (
                            <X size={14} className="inline text-muted" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingPlan && <EditPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} />}
    </AdminShell>
  )
}

export default AdminPlansPage
