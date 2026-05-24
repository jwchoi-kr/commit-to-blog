"use client";

import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/app/_components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";

type Props = {
  user: { name?: string | null; image?: string | null; email?: string | null };
  signOutAction: () => Promise<void>;
};

export function UserMenu({ user, signOutAction }: Props) {
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="계정 메뉴"
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
        >
          <Avatar>
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {user.name && <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>}
        {user.name && <DropdownMenuSeparator />}
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full items-center">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
