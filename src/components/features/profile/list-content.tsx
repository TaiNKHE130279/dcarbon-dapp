'use client';

import React, { useCallback, useMemo, useState } from 'react';
import NextImage from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { doGetListCarbon } from '@/adapters/user';
import DCarbonButton from '@/components/common/button';
import DCarbonLoading from '@/components/common/loading/base-loading';
import { ShowAlert } from '@/components/common/toast';
import { QUERY_KEYS } from '@/utils/constants';
import { getAllCacheDataByKey, shortAddress } from '@/utils/helpers/common';
import {
  Button,
  Image,
  Link,
  Pagination,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  useDisclosure,
} from '@nextui-org/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { env } from 'env.mjs';
import copyIcon from 'public/images/common/copy.svg';
import logo from 'public/images/common/logo.svg';
import solScanIcon from 'public/images/common/sol-scan.png';
import solanaExplorerIcon from 'public/images/common/solana-explorer.png';
import viewIcon from 'public/images/common/view-icon.svg';
import useSWR, { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import BurnModal from './burn-modal';

const rowsPerPage = 10;

type tabTypes = 'certificated' | 'transaction' | 'list-carbon';

function CertificateListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedKeys, setSelectedKeys] = useState<any>(new Set([]));
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { publicKey } = useWallet();
  const [listCarbonPage, setListCarbonPage] = useState<number>(1);
  const { cache } = useSWRConfig();
  const listCarbonCacheData = getAllCacheDataByKey(
    QUERY_KEYS.USER.GET_LIST_CARBON,
    cache,
    'data',
  );
  const [, copy] = useCopyToClipboard();
  const [selectedTab, setSelectedTab] = useState<tabTypes>(
    (searchParams.get('tab') as tabTypes) || 'certificated',
  );

  const { data, isLoading } = useSWR(
    () =>
      publicKey && listCarbonPage && selectedTab === 'list-carbon'
        ? [QUERY_KEYS.USER.GET_LIST_CARBON, publicKey, listCarbonPage]
        : null,
    ([, wallet, page]) => {
      if (!wallet || !page || selectedTab !== 'list-carbon') {
        return null;
      }
      return doGetListCarbon({
        wallet: wallet?.toBase58(),
        page,
        limit: rowsPerPage,
      });
    },
    {
      keepPreviousData: true,
      revalidateOnMount: true,
    },
  );
  const handleChangeTab = useCallback(
    (tab: tabTypes) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);

      const newParams = params.toString();
      setSelectedTab(tab);
      router.push(pathname + '?' + newParams);
    },
    [pathname, router, searchParams],
  );
  const listCarbonPages = useMemo(() => {
    return data?.paging?.total
      ? Math.ceil(data?.paging?.total / rowsPerPage)
      : 0;
  }, [data?.paging?.total]);

  const listCarbonLoadingState = isLoading ? 'loading' : 'idle';

  const certificateRows = useMemo(
    () => [
      {
        key: '1',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60000',
      },
      {
        key: '2',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
      {
        key: '3',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
      {
        key: '4',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },

      {
        key: '5',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
      {
        key: '6',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
      {
        key: '7',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
      {
        key: '8',
        date: 'June 26, 2024',
        name: 'Cert',
        amount: '60',
      },
    ],
    [],
  );

  const certificateColumns = [
    {
      key: 'date',
      label: 'Date',
    },
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'amount',
      label: 'Amount',
    },
    {
      key: 'action',
      label: 'Action',
    },
  ];

  const transactionRows = [
    {
      key: '1',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60',
    },
    {
      key: '2',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60',
    },
    {
      key: '3',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60',
    },
    {
      key: '4',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60000',
    },

    {
      key: '5',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60000',
    },
    {
      key: '6',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60000',
    },
    {
      key: '7',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60000',
    },
    {
      key: '8',
      date: 'June 26, 2024',
      name: 'Cert',
      amount: '60000',
    },
  ];

  const listCarbonColumns = [
    { key: 'mint', label: 'Token address' },
    {
      key: 'amount',
      label: 'Total Carbon',
    },
    {
      key: 'symbol',
      label: 'Token Symbol',
    },
    {
      key: 'action',
      label: 'Action',
    },
  ];

  const renderCell = React.useCallback(
    (user: any, columnKey: React.Key, type?: 'transaction' | 'list-carbon') => {
      const cellValue = user[columnKey as keyof any];

      switch (columnKey) {
        case 'mint': {
          return (
            <div className="mt-[10px] text-sm font-light flex gap-[5px] items-center">
              <span className="text-[#4F4F4F]">
                {shortAddress('text', cellValue)}
              </span>
              <Button
                onClick={async () => {
                  await copy(cellValue || '');
                  ShowAlert.success({ message: 'Copied to clipboard' });
                }}
                variant="light"
                isIconOnly
                className="h-[24px] min-w-[24px] w-[24px] data-[hover=true]:bg-transparent"
                radius="none"
                disableRipple
                disableAnimation
              >
                <Image
                  src={copyIcon.src}
                  alt="Copy"
                  width={20}
                  height={20}
                  as={NextImage}
                  draggable={false}
                />
              </Button>
            </div>
          );
        }
        case 'date': {
          return <span className="text-[#4F4F4F]">{cellValue}</span>;
        }
        case 'name': {
          return <span className="text-base">{cellValue}</span>;
        }
        case 'symbol': {
          return <span className="text-base">{user?.symbol}</span>;
        }
        case 'action': {
          if (type === 'transaction' || type === 'list-carbon') {
            return (
              <div className="relative flex gap-4">
                <Link
                  href={`https://explorer.solana.com/address/${user?.token_account || ''}${env.NEXT_PUBLIC_MODE === 'prod' ? '' : '?cluster=devnet'}`}
                  isExternal
                >
                  <Image
                    src={solanaExplorerIcon.src}
                    alt="Solana Explorer"
                    as={NextImage}
                    width={24}
                    height={24}
                    draggable={false}
                    radius="none"
                    className="min-w-[24px]"
                  />
                </Link>

                <Link
                  href={`https://solscan.io/account/${user?.token_account || ''}${env.NEXT_PUBLIC_MODE === 'prod' ? '' : '?cluster=devnet'}`}
                  isExternal
                >
                  <Image
                    src={solScanIcon.src}
                    alt="Solscan"
                    as={NextImage}
                    width={24}
                    height={24}
                    draggable={false}
                    radius="none"
                    className="min-w-[24px]"
                  />
                </Link>
              </div>
            );
          }
          return (
            <div className="relative flex">
              <Image
                src={viewIcon.src}
                alt="View"
                as={NextImage}
                width={24}
                height={24}
                draggable={false}
              />
            </div>
          );
        }
        case 'amount': {
          if (type === 'transaction') {
            return (
              <span className="text-base">
                {(+user?.amount || 0)?.toLocaleString('en-US')} USDC
              </span>
            );
          }

          return (
            <div className="relative flex gap-2 items-center text-base">
              <Image
                src={logo.src}
                alt="DCarbon"
                as={NextImage}
                width={24}
                height={24}
                draggable={false}
              />

              <span>
                {(+user?.amount || 0)?.toLocaleString('en-US')}{' '}
                {user?.name || 'Carbon'}
              </span>
            </div>
          );
        }
        default:
          return cellValue;
      }
    },
    [],
  );

  const totalAmountWillBurn = useMemo(() => {
    if (selectedKeys.size === 0) {
      return 0;
    }
    if (selectedKeys === 'all') {
      return listCarbonCacheData?.reduce((current, item) => {
        return current + (+item.amount || 0);
      }, 0);
    }
    let count = 0;
    selectedKeys.forEach((value: any) => {
      const newAmount = +(
        listCarbonCacheData?.find((item) => item.mint === value)?.amount || 0
      );
      count += newAmount;
    });

    return count;
  }, [listCarbonCacheData, selectedKeys]);

  return (
    <>
      <Tabs
        key="mode"
        variant="light"
        aria-label="Certificate List"
        classNames={{
          tab: 'h-[49px] w-full sm:min-w-[204px] data-[focus-visible=true]:outline-0',
          cursor: 'shadow-none bg-[#F6F6F6]',
          tabContent:
            'xl:text-[23px] font-medium group-data-[selected=true]:text-[#21272A]',
          tabList: 'p-0',
          panel: 'pt-[24px] pb-0 w-full',
        }}
        selectedKey={selectedTab}
        onSelectionChange={(tab) => handleChangeTab(tab as tabTypes)}
      >
        <Tab key="certificated" title="Certificated">
          <Table
            aria-label="Certificated Table"
            shadow="none"
            radius="none"
            classNames={{
              th: 'bg-white h-[56px] border-b-1 border-[#DDE1E6] text-sm text-[#4F4F4F] font-medium',
              td: 'h-[48px] rounded-[4px]',
              tbody: '[&>*:nth-child(odd)]:bg-[#F6F6F6]',
              wrapper: 'p-0',
            }}
          >
            <TableHeader columns={certificateColumns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody items={certificateRows}>
              {(item) => (
                <TableRow key={item.key}>
                  {(columnKey) => (
                    <TableCell>{renderCell(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Tab>
        <Tab key="transaction" title="Transaction">
          <Table
            aria-label="Transaction Table"
            shadow="none"
            radius="none"
            classNames={{
              th: 'bg-white h-[56px] border-b-1 border-[#DDE1E6] text-sm text-[#4F4F4F] font-medium',
              td: 'h-[48px] rounded-[4px]',
              tbody: '[&>*:nth-child(odd)]:bg-[#F6F6F6]',
              wrapper: 'p-0',
            }}
          >
            <TableHeader columns={certificateColumns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody items={transactionRows}>
              {(item) => (
                <TableRow key={item.key}>
                  {(columnKey) => (
                    <TableCell>
                      {renderCell(item, columnKey, 'transaction')}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Tab>

        <Tab key="list-carbon" title="List Carbon">
          <div className="mb-2">
            <DCarbonButton
              color="primary"
              className="min-w-[150px] h-[34px]"
              onClick={onOpen}
            >
              Burn
            </DCarbonButton>
          </div>
          <div>
            <Table
              bottomContent={
                listCarbonPages > 1 ? (
                  <div className="flex w-full justify-center z-[11]">
                    <Pagination
                      isCompact
                      showControls
                      showShadow
                      color="success"
                      page={listCarbonPage}
                      total={listCarbonPages}
                      onChange={(page) => setListCarbonPage(page)}
                    />
                  </div>
                ) : null
              }
              checkboxesProps={{
                radius: 'none',
                size: 'sm',
                classNames: {
                  wrapper:
                    'before:border-[#454545] before:border-1 after:bg-primary-color',
                },
              }}
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              aria-label="List Carbon Table"
              shadow="none"
              radius="none"
              classNames={{
                th: 'bg-white h-[56px] border-b-1 border-[#DDE1E6] text-sm text-[#4F4F4F] font-medium',
                td: 'h-[48px] rounded-[4px] group-aria-[selected=false]:group-data-[hover=true]:before:bg-[#EAFFC7] cursor-pointer data-[selected=true]:before:bg-[#EAFFC7]',
                tbody: '[&>*:nth-child(odd)]:bg-[#F6F6F6]',
                wrapper: 'p-0',
              }}
              removeWrapper
            >
              <TableHeader columns={listCarbonColumns}>
                {(column) => (
                  <TableColumn key={column.key}>{column.label}</TableColumn>
                )}
              </TableHeader>
              <TableBody
                emptyContent={'No Carbon found!'}
                items={data?.data || []}
                loadingContent={<DCarbonLoading />}
                loadingState={listCarbonLoadingState}
              >
                {(item) => (
                  <TableRow key={item.mint}>
                    {(columnKey) => (
                      <TableCell>
                        {renderCell(item, columnKey, 'list-carbon')}
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Tab>
      </Tabs>
      <BurnModal
        isOpen={isOpen}
        onClose={onClose}
        amount={totalAmountWillBurn}
      />
    </>
  );
}

export default CertificateListContent;
