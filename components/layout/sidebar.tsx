"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard, FolderKanban, Tags, FileText,
  Sparkles, Plug, BarChart3, Users, Settings, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Role } from "@prisma/client"

const ALL_NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, roles: ["ADMIN","PROJECT_MANAGER","EDITOR","CUSTOMER"] },
  { href: "/projects",     label: "Projects",     icon: FolderKanban,    roles: ["ADMIN","PROJECT_MANAGER","EDITOR"] },
  { href: "/keywords",     label: "Keywords",     icon: Tags,            roles: ["ADMIN","PROJECT_MANAGER","EDITOR"] },
  { href: "/articles",     label: "Articles",     icon: FileText,        roles: ["ADMIN","PROJECT_MANAGER","EDITOR"] },
  { href: "/ai-templates", label: "AI Templates", icon: Sparkles,        roles: ["ADMIN","PROJECT_MANAGER"] },
  { href: "/connections",  label: "Connections",  icon: Plug,            roles: ["ADMIN","PROJECT_MANAGER"] },
  { href: "/reports",      label: "Reports",      icon: BarChart3,       roles: ["ADMIN","PROJECT_MANAGER","EDITOR","CUSTOMER"] },
  { href: "/users",        label: "Users",        icon: Users,           roles: ["ADMIN"] },
  { href: "/settings",     label: "Settings",     icon: Settings,        roles: ["ADMIN","PROJECT_MANAGER","EDITOR","CUSTOMER"] },
]

interface SidebarProps {
  role: Role
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = ALL_NAV.filter((item) => item.roles.includes(role))

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "flex flex-col h-full border-r border-zinc-200 bg-white transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-14 px-3 border-b border-zinc-200",
          collapsed ? "justify-center" : "gap-2.5 px-4"
        )}>
          <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-zinc-900 text-sm">BlogPlanner</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            const item = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger>{item}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }
            return item
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-zinc-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full h-8 text-zinc-400 hover:text-zinc-600", collapsed && "px-0")}
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-1.5 text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
