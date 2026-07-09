"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, MessageSquare, Trash2, UserPlus, Users } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const roles = ["JOB_SEEKER", "EMPLOYER", "FREELANCER", "ADMIN"];
type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type Contact = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export default function AdminPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState("users");
  const [notice, setNotice] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"all" | "role" | "specific">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const load = useCallback(async () => {
    const [u, c] = await Promise.all([
      authenticatedFetch(`${API_URL}/admin/users`),
      authenticatedFetch(`${API_URL}/admin/contacts`),
    ]);
    if (u.ok) setUsers(await u.json());
    if (c.ok) setContacts(await c.json());
  }, []);
  useEffect(() => {
    if (ready && user?.role !== "ADMIN") router.replace("/");
    if (user?.role === "ADMIN") load();
  }, [ready, user, router, load]);
  if (!ready || user?.role !== "ADMIN")
    return (
      <div className="container-page py-24 text-center text-muted">
        Checking administrator access…
      </div>
    );
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await authenticatedFetch(`${API_URL}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json();
    setNotice(
      response.ok
        ? "User created."
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message,
    );
    if (response.ok) {
      form.reset();
      load();
    }
  }
  async function updateUser(id: string, data: object) {
    const response = await authenticatedFetch(`${API_URL}/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.ok) load();
  }
  async function removeUser(id: string) {
    const response = await authenticatedFetch(`${API_URL}/admin/users/${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setNotice(data.reason || (response.ok ? "User deleted." : data.message));
    setDeleteUserId(null);
    await load();
  }
  async function updateContact(id: string, status: string) {
    const response = await authenticatedFetch(
      `${API_URL}/admin/contacts/${id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (response.ok) load();
  }
  async function broadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = formData.get("title");
    const body = formData.get("body");
    
    const payload: Record<string, any> = { title, body };
    if (targetType === "role") {
      payload.role = formData.get("role");
    } else if (targetType === "specific") {
      if (selectedUserIds.length === 0) {
        setNotice("Please select at least one recipient.");
        return;
      }
      payload.userIds = selectedUserIds;
    }

    const response = await authenticatedFetch(
      `${API_URL}/admin/notifications/broadcast`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json();
    setNotice(
      response.ok ? `Delivered to ${data.delivered} users.` : data.message,
    );
    if (response.ok) {
      form.reset();
      setSelectedUserIds([]);
      setTargetType("all");
    }
  }
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="bg-primary py-12 text-white">
        <div className="container-page">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Secure administration
          </p>
          <h1 className="mt-3 text-4xl font-black">Platform control center</h1>
        </div>
      </section>
      <div className="container-page py-10">
        <div className="mb-6 flex gap-2">
          <Tab
            active={tab === "users"}
            onClick={() => setTab("users")}
            icon={Users}
          >
            Users
          </Tab>
          <Tab
            active={tab === "contacts"}
            onClick={() => setTab("contacts")}
            icon={MessageSquare}
          >
            Messages
          </Tab>
          <Tab
            active={tab === "broadcast"}
            onClick={() => setTab("broadcast")}
            icon={BellRing}
          >
            Notify
          </Tab>
        </div>
        {notice && (
          <p className="mb-5 rounded-xl bg-brandGreen/10 p-3 text-sm font-semibold text-brandGreen">
            {notice}
          </p>
        )}
        {tab === "users" && (
          <div className="space-y-6">
            <form
              onSubmit={createUser}
              className="grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-6"
            >
              <Input name="firstName" placeholder="First name" />
              <Input name="lastName" placeholder="Last name" />
              <Input name="email" type="email" placeholder="Email" />
              <Input name="password" type="password" placeholder="Password" />
              <select name="role" className="control">
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              <button className="flex items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
                <UserPlus className="h-4 w-4" /> Add
              </button>
            </form>
            <div className="overflow-x-auto rounded-2xl bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="bg-primary/5 text-xs uppercase text-muted">
                    <th className="p-4">User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="p-4">
                        <b>
                          {item.firstName} {item.lastName}
                        </b>
                        <p className="text-xs text-muted">{item.email}</p>
                      </td>
                      <td>
                        <select
                          value={item.role}
                          onChange={(e) =>
                            updateUser(item.id, { role: e.target.value })
                          }
                          className="rounded-lg border p-2 text-xs"
                        >
                          {roles.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            updateUser(item.id, { isActive: !item.isActive })
                          }
                          className={
                            item.isActive ? "text-brandGreen" : "text-redAccent"
                          }
                        >
                          {item.isActive ? "Active" : "Suspended"}
                        </button>
                      </td>
                      <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => setDeleteUserId(item.id)}
                          className="text-redAccent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === "contacts" && (
          <div className="space-y-3">
            {contacts.map((item) => (
              <article key={item.id} className="rounded-2xl bg-white p-5">
                <div className="flex justify-between gap-4">
                  <div>
                    <b>{item.subject}</b>
                    <p className="text-xs text-muted">
                      {item.name} · {item.email}
                    </p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateContact(item.id, e.target.value)}
                    className="rounded-lg border px-2 text-xs"
                  >
                    <option>NEW</option>
                    <option>READ</option>
                    <option>RESOLVED</option>
                  </select>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted">
                  {item.message}
                </p>
              </article>
            ))}
          </div>
        )}
        {tab === "broadcast" && (() => {
          const filteredUsers = searchQuery.trim() === ""
            ? users.filter(u => !selectedUserIds.includes(u.id) && u.isActive)
            : users.filter(u => 
                !selectedUserIds.includes(u.id) && 
                u.isActive &&
                (`${u.firstName} ${u.lastName} ${u.email}`).toLowerCase().includes(searchQuery.toLowerCase())
              );

          return (
            <form
              onSubmit={broadcast}
              className="max-w-2xl space-y-4 rounded-2xl bg-white p-6"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted">Recipients Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("all")}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition-colors ${
                      targetType === "all" ? "bg-primary text-white border-primary" : "bg-white text-muted border-border hover:bg-pageBg"
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("role")}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition-colors ${
                      targetType === "role" ? "bg-primary text-white border-primary" : "bg-white text-muted border-border hover:bg-pageBg"
                    }`}
                  >
                    By Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("specific")}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition-colors ${
                      targetType === "specific" ? "bg-primary text-white border-primary" : "bg-white text-muted border-border hover:bg-pageBg"
                    }`}
                  >
                    Specific User(s)
                  </button>
                </div>
              </div>

              {targetType === "role" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted">Select Role</label>
                  <select name="role" required className="control w-full">
                    <option value="">Select role...</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "specific" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted">Selected Recipients</label>
                    <div className="flex flex-wrap gap-2 p-2.5 border border-border rounded-xl bg-pageBg min-h-[44px]">
                      {selectedUserIds.length === 0 ? (
                        <span className="text-xs text-muted flex items-center">No recipients selected yet. Use search below.</span>
                      ) : (
                        selectedUserIds.map(id => {
                          const u = users.find(x => x.id === id);
                          if (!u) return null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              {u.firstName} {u.lastName}
                              <button
                                type="button"
                                onClick={() => setSelectedUserIds(prev => prev.filter(x => x !== id))}
                                className="hover:text-redAccent focus:outline-none ml-1 font-bold text-sm"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                  
                  <div className="relative space-y-1">
                    <label className="text-xs font-bold uppercase text-muted">Search User</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type name or email to search..."
                      className="control w-full text-sm"
                    />
                    {searchQuery.trim() !== "" && (
                      <div className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-white shadow-xl p-1.5 space-y-1">
                        {filteredUsers.length === 0 ? (
                          <p className="text-xs text-muted p-2 text-center">No active users match search.</p>
                        ) : (
                          filteredUsers.slice(0, 10).map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUserIds(prev => [...prev, u.id]);
                                setSearchQuery("");
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-ink hover:bg-pageBg transition-colors"
                            >
                              <div>
                                <p className="font-bold">{u.firstName} {u.lastName}</p>
                                <p className="text-muted text-[10px]">{u.email}</p>
                              </div>
                              <span className="bg-brandGreen/10 text-brandGreen font-extrabold px-2 py-0.5 rounded text-[9px] uppercase">
                                {u.role}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted">Message Title</label>
                <Input name="title" placeholder="Enter title" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted">Message Body</label>
                <textarea
                  name="body"
                  required
                  minLength={5}
                  rows={5}
                  placeholder="Enter message body..."
                  className="control w-full text-sm"
                />
              </div>

              <button className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brandGreen">
                Send notification
              </button>
            </form>
          );
        })()}
      </div>
      <ConfirmDialog
        open={Boolean(deleteUserId)}
        onOpenChange={(open) => !open && setDeleteUserId(null)}
        title="Permanently delete this user?"
        description="This removes the account and associated access. This action cannot be undone."
        confirmLabel="Delete user"
        destructive
        onConfirm={() => {
          if (deleteUserId) return removeUser(deleteUserId);
        }}
      />
    </div>
  );
}
function Input({
  name,
  placeholder,
  type = "text",
}: {
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      required
      minLength={type === "password" ? 8 : 2}
      placeholder={placeholder}
      className="control w-full"
    />
  );
}
function Tab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ${active ? "bg-primary text-white" : "bg-white text-primary"}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
