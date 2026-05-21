"use client"

import { signOut, useSession } from "next-auth/react"
import { Bell, Search, LogOut, User, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function Topbar() {
  const { data: session } = useSession()
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() ?? "?"

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 gap-4">
      {/* Search */}
      <button className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 w-64 hover:border-zinc-300 transition-colors">
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto text-xs bg-white border border-zinc-200 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-400 hover:text-zinc-600 relative">
          <Bell className="w-4 h-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 h-8 px-2 rounded-md text-sm font-medium hover:bg-zinc-100 transition-colors">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs bg-zinc-900 text-white">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-zinc-700 hidden sm:block">
                {session?.user?.name ?? session?.user?.email}
              </span>
              <Badge variant="outline" className="text-xs hidden sm:flex">
                {session?.user?.role?.toLowerCase().replace("_", " ")}
              </Badge>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-zinc-500 font-normal">
              {session?.user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-3.5 h-3.5 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
