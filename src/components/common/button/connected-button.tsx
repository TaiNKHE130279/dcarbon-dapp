import React from 'react';
import NextImage from 'next/image';
import {
  Button,
  cn,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Image,
} from '@nextui-org/react';
import { useWallet } from '@solana/wallet-adapter-react';

function ConnectedButton() {
  const { publicKey, connected, wallet, disconnect, disconnecting } =
    useWallet();

  if (!publicKey || !connected || !wallet) {
    return null;
  }

  return (
    <Dropdown
      showArrow
      radius="sm"
      classNames={{
        base: 'before:bg-default-200', // change arrow background
        content: 'p-0 border-small border-divider bg-background',
      }}
    >
      <DropdownTrigger>
        <Button
          isLoading={disconnecting}
          disableRipple
          color="primary"
          variant="flat"
          startContent={
            <Image
              src={wallet.adapter.icon}
              alt="icon"
              width={20}
              height={20}
              as={NextImage}
              radius="sm"
              className="border-1 min-w-5"
              draggable={false}
            />
          }
          type="button"
          className={cn(
            'bg-[#7BDA08] text-[#1B1B1B] hover:bg-[#5DAF01] font-medium rounded-[4px] py-[16px] px-[32px]',
          )}
        >
          {(publicKey?.toBase58()?.slice(0, 5) || '') +
            '...' +
            (publicKey?.toBase58()?.slice(-5) || '')}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Connect menu"
        className="p-3"
        itemClasses={{
          base: [
            'rounded-md',
            'text-default-500',
            'transition-opacity',
            'data-[hover=true]:text-foreground',
            'data-[hover=true]:bg-default-100',
            'dark:data-[hover=true]:bg-default-50',
            'data-[selectable=true]:focus:bg-default-50',
            'data-[pressed=true]:opacity-70',
            'data-[focus-visible=true]:ring-default-500',
          ],
        }}
      >
        <DropdownItem key="disconnect" onClick={disconnect}>
          Disconnect
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

export default ConnectedButton;
