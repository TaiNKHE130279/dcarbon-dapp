'use client';

import React, { useCallback, useState } from 'react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { doGetMintMetada } from '@/adapters/common';
import {
  doGenerateBurnMetadata,
  doGenerateNftMetadata,
  doModifyBurnHistoryStatus,
  IGetListCarbonResponse,
} from '@/adapters/user';
import { ShowAlert } from '@/components/common/toast';
import { CARBON_IDL } from '@/contracts/carbon/carbon.idl';
import { ICarbonContract } from '@/contracts/carbon/carbon.interface';
import { QUERY_KEYS, THROW_EXCEPTION } from '@/utils/constants';
import { logger, splitArrayIntoChunks } from '@/utils/helpers/common';
import { IBurningCarbon } from '@/utils/helpers/profile';
import { createTransactionV0, sendTx } from '@/utils/helpers/solana';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { Link, Tab, Tabs } from '@nextui-org/react';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';
import {
  BlockhashWithExpiryBlockHeight,
  PublicKey,
  RpcResponseAndContext,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import Big from 'big.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { env } from 'env.mjs';
import certificateIcon from 'public/images/projects/cerfiticate-icon.png';
import { KeyedMutator, useSWRConfig } from 'swr';
import { mintNft } from '@utils/contract/contract.util';

import DCarbonButton from '../../../common/button';
import DCarbonModal from '../../../common/modal';
import NftModal from '../../certificate/nftModal';
import CertificateCorporate from './certificate-corporate';
import CertificateIndividual from './certificate-individual';

dayjs.extend(utc);

type TTab = 'individual' | 'corporate';

function CertificateModal({
  router,
  isOpen,
  onClose,
  onBack,
  amount,
  mints,
  allMints = [],
  mutate,
  reset,
}: {
  router: AppRouterInstance;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  amount: number;
  mints?: { mint: string; amount: number }[];
  allMints: IBurningCarbon[];
  mutate: KeyedMutator<IGetListCarbonResponse | null>;
  reset: () => void;
}) {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState<boolean>(false);

  const [name, setName] = useState<string>('');
  const [isNameInvalid, setIsNameInvalid] = useState<boolean>(false);

  const [projectType, setProjectType] = useState<string>('');
  const [isProjectTypeInvalid, setIsProjectTypeInvalid] =
    useState<boolean>(false);

  const [projectLocation, setProjectLocation] = useState<string>('');
  const [isProjectLocationInvalid, setIsProjectLocationInvalid] =
    useState<boolean>(false);

  const [reason, setReason] = useState<string>('');

  const [address, setAddress] = useState<string>('');
  const [isAddressInvalid, setIsAddressInvalid] = useState<boolean>(false);
  const [country, setCountry] = useState<string>('');
  const [isCountryInvalid, setIsCountryInvalid] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<TTab>('individual');
  const { mutate: globalMutate } = useSWRConfig();
  const [visibleNftSuccess, setVisibleNftSuccess] = useState<boolean>(false);
  const [nftSuccessData, setNftSuccessData] = useState<{
    name: string;
    burned_at: string;
    burn_tx: string[];
    amount: string;
    project_name: string;
    asset_type: 'sFT' | 'FT';
  }>();
  const RetryLink = useCallback(() => {
    return (
      <>
        <br />
        <Link
          className={'font-medium px-2 cursor-pointer'}
          onClick={() => router.push('/profile?tab=transaction&type=burn')}
        >
          Retry
        </Link>
      </>
    );
  }, []);
  return (
    <>
      <DCarbonModal
        onClose={onClose}
        isOpen={isOpen}
        title="Certificate Info"
        icon={certificateIcon.src}
        cancelBtn={
          <DCarbonButton
            fullWidth
            className="bg-[#F6F6F6]"
            onClick={onBack}
            isDisabled={loading}
          >
            Back
          </DCarbonButton>
        }
        isDismissable={!loading}
        okBtn={
          <DCarbonButton
            isLoading={loading}
            color="primary"
            fullWidth
            onClick={async () => {
              if (!publicKey || !wallet || !anchorWallet || !connection) {
                ShowAlert.error({ message: 'Please connect to wallet first!' });
                return;
              }

              if (!(wallet?.adapter as any)?.signAllTransactions) {
                ShowAlert.error({
                  message: 'Your wallet not support signAllTransactions!',
                });
                return;
              }

              if (!amount) {
                ShowAlert.error({ message: 'Please input amount of Carbon!' });
                return;
              }

              if (!mints || mints.length === 0) {
                ShowAlert.error({ message: 'Please select a Carbon to burn!' });
                return;
              }

              if (!allMints || allMints.length === 0) {
                ShowAlert.error({ message: 'Not found mint list!' });
                return;
              }

              if (!name) {
                setIsNameInvalid(true);
                return;
              }

              if (!projectType) {
                setIsProjectTypeInvalid(true);
                return;
              }

              if (!projectLocation) {
                setIsProjectLocationInvalid(true);
                return;
              }

              if (!country) {
                setIsCountryInvalid(true);
                return;
              }

              if (selectedTab === 'corporate') {
                if (!address) {
                  setIsAddressInvalid(true);
                  return;
                }
              }

              setLoading(true);
              ShowAlert.loading({
                message: 'Generate transaction to burn Carbon...',
              });
              try {
                let burnResult:
                  | {
                      value?: {
                        tx: string;
                      };
                      status: 'rejected' | 'fulfilled';
                    }[]
                  | {
                      tx: string;
                      error?: string;
                    }
                  | null = null;

                let mintResult:
                  | {
                      tx?: string;
                      error?: string;
                    }
                  | null
                  | undefined = null;
                const provider = new AnchorProvider(connection, anchorWallet);
                const program = new Program<ICarbonContract>(
                  CARBON_IDL as ICarbonContract,
                  provider,
                );
                const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
                  MPL_TOKEN_METADATA_PROGRAM_ID.toString(),
                );

                const burnTransactions: {
                  tx: VersionedTransaction;
                  blockhash: RpcResponseAndContext<BlockhashWithExpiryBlockHeight>;
                }[] = [];
                const burnInstructions: TransactionInstruction[] = [];
                for await (const mint of mints) {
                  const carbonMint = new PublicKey(mint.mint);

                  const burnAta = getAssociatedTokenAddressSync(
                    carbonMint,
                    publicKey,
                  );
                  const [metadata] = PublicKey.findProgramAddressSync(
                    [
                      Buffer.from('metadata'),
                      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                      carbonMint.toBuffer(),
                    ],
                    TOKEN_METADATA_PROGRAM_ID,
                  );
                  const tx = await program.methods
                    .burnSft(mint?.amount || 0)
                    .accounts({
                      signer: publicKey,
                      mintSft: carbonMint,
                      burnAta,
                      metadataSft: metadata,
                      tokenProgram: TOKEN_PROGRAM_ID,
                      sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
                      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                    })
                    .instruction();

                  if (tx) {
                    burnInstructions.push(tx);
                  }
                }

                const newBurnInstructions = splitArrayIntoChunks(
                  burnInstructions,
                  6,
                );

                for await (const instruction of newBurnInstructions) {
                  const burnTxV0 = await createTransactionV0(
                    connection,
                    publicKey,
                    instruction,
                  );

                  if (burnTxV0) {
                    burnTransactions.push(burnTxV0);
                  }
                }

                ShowAlert.loading({ message: 'Burning Carbon...' });
                const resultBurnTx = (await sendTx({
                  connection,
                  wallet,
                  transactions:
                    burnTransactions?.length > 1
                      ? burnTransactions
                      : burnTransactions[0],
                })) as
                  | {
                      value?: {
                        tx: string;
                      };
                      status: 'rejected' | 'fulfilled';
                    }[]
                  | {
                      tx: string;
                      error?: string;
                    };

                burnResult = resultBurnTx;

                let projectName: string = '';
                let isNotFt;

                if (
                  (Array.isArray(resultBurnTx) &&
                    !resultBurnTx?.find((tx) => tx?.status === 'rejected')) ||
                  (!Array.isArray(resultBurnTx) && resultBurnTx?.tx)
                ) {
                  ShowAlert.loading({ message: 'Generating certificate...' });

                  const mintMetadaResult = await doGetMintMetada(
                    publicKey.toBase58(),
                    mints?.map((m) => m.mint)?.join(',') || '',
                  );

                  const newProjectName =
                    mintMetadaResult?.data?.attributes?.find((attr) =>
                      ['Project Name', 'Project'].includes(attr.trait_type),
                    )?.value;

                  if (newProjectName) {
                    projectName = newProjectName;
                  }
                  const infoBurn = (
                    status: 'rejected' | 'finished' | 'error',
                  ) =>
                    Array.isArray(burnResult)
                      ? burnResult
                          ?.filter((tx) => tx.status === 'fulfilled')
                          ?.map((tx) => ({
                            tx: tx?.value?.tx as string,
                            status,
                          }))
                      : burnResult?.tx
                        ? [{ tx: burnResult.tx, status }]
                        : [];

                  const [configContract] = PublicKey.findProgramAddressSync(
                    [Buffer.from('contract_config')],
                    program.programId,
                  );
                  const configData =
                    await program.account.contractConfig.fetch(configContract);

                  const mintFt = configData.mint;

                  isNotFt = mints?.find((m) => m.mint !== mintFt.toString());

                  const pdfResponse = await doGenerateBurnMetadata(
                    publicKey.toBase58(),
                    {
                      amount,
                      transactions: Array.isArray(resultBurnTx)
                        ? resultBurnTx.map((tx) => tx?.value?.tx as string)
                        : [resultBurnTx.tx],
                      date: dayjs().utc().unix(),
                      owner: name,
                      project_name: projectName,
                      asset_type: isNotFt ? 'sFT' : 'FT',
                    },
                  );
                  if (!pdfResponse?.data?.url) {
                    ShowAlert.dismiss('loading');
                    ShowAlert.error({
                      body: (
                        <div>Failed to generate certificate!{RetryLink()}</div>
                      ),
                    });
                    const infoBurnError = infoBurn('error');
                    if (infoBurnError.length > 0) {
                      await doModifyBurnHistoryStatus({
                        info: infoBurnError,
                      }).catch((e) => {
                        const error = e as Error;
                        logger({ message: error?.toString(), type: 'ERROR' });
                      });
                    }
                    return;
                  }

                  ShowAlert.loading({
                    message: 'Generating NFT certificate metadata...',
                  });

                  const metadata = await doGenerateNftMetadata(
                    publicKey.toBase58(),
                    {
                      name: 'DCO2 Certificate',
                      symbol: 'DCC',
                      image: 'image',
                      attributes: [
                        {
                          trait_type: 'name',
                          value: name,
                        },
                        {
                          trait_type: 'amount',
                          value: amount.toString(),
                        },
                        {
                          trait_type: 'project_type',
                          value: projectType,
                        },
                        {
                          trait_type: 'project_location',
                          value: projectLocation,
                        },
                        { trait_type: 'file', value: pdfResponse.data.url },
                        {
                          trait_type: 'burned_at',
                          value: dayjs.utc().format('DD.MM.YYYY'),
                        },
                        {
                          trait_type: 'asset_type',
                          value: isNotFt ? 'sFT' : 'FT',
                        },
                        ...(projectName
                          ? [{ trait_type: 'project_name', value: projectName }]
                          : []),
                        ...(Array.isArray(resultBurnTx)
                          ? resultBurnTx?.map((tx) => ({
                              trait_type: 'burn_tx',
                              value: tx?.value?.tx || '',
                            })) || []
                          : [
                              {
                                trait_type: 'burn_tx',
                                value: resultBurnTx?.tx || '',
                              },
                            ]),
                        ...(reason
                          ? [
                              {
                                trait_type: 'reason',
                                value: reason,
                              },
                            ]
                          : []),
                        ...(selectedTab === 'corporate' && address
                          ? [
                              {
                                trait_type: 'address',
                                value: address,
                              },
                            ]
                          : []),

                        {
                          trait_type: 'country',
                          value: country,
                        },
                      ],
                    },
                  );
                  if (!metadata?.data?.uri) {
                    ShowAlert.dismiss('loading');
                    ShowAlert.error({
                      body: (
                        <div>
                          Failed to generate NFT Certificate metadata!
                          {RetryLink()}
                        </div>
                      ),
                    });
                    const infoBurnError = infoBurn('error');
                    if (infoBurnError.length > 0) {
                      await doModifyBurnHistoryStatus({
                        info: infoBurnError,
                      }).catch((e) => {
                        const error = e as Error;
                        logger({ message: error?.toString(), type: 'ERROR' });
                      });
                    }
                    return;
                  }
                  ShowAlert.loading({ message: 'Minting NFT certificate...' });
                  try {
                    mintResult = await mintNft(
                      {
                        program,
                        connection,
                        anchorWallet,
                        wallet,
                        signer: publicKey,
                      },
                      {
                        uri: metadata.data?.uri,
                        amount,
                      },
                    );

                    if (mintResult?.tx) {
                      const infoBurnFinished = infoBurn('finished');

                      if (infoBurnFinished.length > 0) {
                        await doModifyBurnHistoryStatus({
                          info: infoBurnFinished,
                          mint_tx: mintResult?.tx,
                        }).catch((e) => {
                          const error = e as Error;
                          logger({
                            message: error?.toString(),
                            type: 'ERROR',
                          });
                        });
                      }
                    }

                    if (
                      mintResult?.error ===
                      THROW_EXCEPTION.USER_REJECTED_REQUEST
                    ) {
                      const infoBurnRejected = infoBurn('rejected');

                      if (infoBurnRejected.length > 0) {
                        await doModifyBurnHistoryStatus({
                          info: infoBurnRejected,
                        }).catch((e) => {
                          const error = e as Error;
                          logger({
                            message: error?.toString(),
                            type: 'ERROR',
                          });
                        });
                      }
                      ShowAlert.error({
                        body: (
                          <div>Mint request was rejected!{RetryLink()}</div>
                        ),
                      });
                    }
                  } catch (e) {
                    const infoBurnError = infoBurn('error');

                    if (infoBurnError.length > 0) {
                      await doModifyBurnHistoryStatus({
                        info: infoBurnError,
                      }).catch((e) => {
                        const error = e as Error;
                        logger({ message: error?.toString(), type: 'ERROR' });
                      });
                    }
                    throw e;
                  }
                }

                let index = 0;
                const success = [];
                const fails = [];
                const certificateResult = [];

                if (Array.isArray(burnResult)) {
                  for await (const res of burnResult) {
                    if (res.status === 'rejected') {
                      fails.push(
                        `<div>Burn failed ${Number(
                          Big(mints?.[index]?.amount || 0).toFixed(1),
                        ).toLocaleString(
                          'en-US',
                        )} Carbon: <span class="text-danger">Error</span>.</div>`,
                      );
                    }
                    if (res.status === 'fulfilled') {
                      success.push(
                        `<div>Burn successfully ${Number(
                          Big(mints?.[index]?.amount || 0).toFixed(1),
                        ).toLocaleString(
                          'en-US',
                        )} Carbon: <a class="underline" href="https://explorer.solana.com/tx/${res?.value?.tx || ''}${env.NEXT_PUBLIC_MODE === 'prod' ? '' : '?cluster=devnet'}" rel="noopener noreferrer" target="_blank">View transaction</a></div>`,
                      );
                    }
                    index++;
                  }
                }

                if (!Array.isArray(burnResult)) {
                  if (
                    burnResult?.error === THROW_EXCEPTION.USER_REJECTED_REQUEST
                  ) {
                    return;
                  }

                  if (burnResult?.tx) {
                    success.push(
                      `<div>Burn successfully ${Number(
                        Big(mints?.[index]?.amount || 0).toFixed(1),
                      ).toLocaleString(
                        'en-US',
                      )} Carbon: <a class="underline" href="https://explorer.solana.com/tx/${burnResult?.tx || ''}${env.NEXT_PUBLIC_MODE === 'prod' ? '' : '?cluster=devnet'}" rel="noopener noreferrer" target="_blank">View transaction</a></div>`,
                    );
                  } else {
                    fails.push(
                      `<div>Burn failed ${Number(
                        Big(mints?.[index]?.amount || 0).toFixed(1),
                      ).toLocaleString(
                        'en-US',
                      )} Carbon: <span class="text-danger">Error</span>.</div>`,
                    );
                  }
                }

                if (mintResult?.tx) {
                  certificateResult.push(
                    `<div>Mint NFT certificate successfully: <a class="underline" href="https://explorer.solana.com/tx/${mintResult.tx}${env.NEXT_PUBLIC_MODE === 'prod' ? '' : '?cluster=devnet'}" rel="noopener noreferrer" target="_blank">View transaction</a></div>`,
                  );
                } else {
                  certificateResult.push(
                    `<div>Mint NFT certificate failed <span class="text-danger"><a class="underline" href="/profile?tab=transaction&type=burn" rel="noopener noreferrer">- Retry</a></span>.</div>`,
                  );
                }

                const merged = `<div class="flex flex-col gap-2">${[...success, ...fails, ...certificateResult].join('')}</div>`;
                if (success.length > 0) {
                  ShowAlert.success({
                    message: merged,
                  });

                  if (mintResult?.tx) {
                    setNftSuccessData({
                      name,
                      amount: amount.toString(),
                      burned_at: dayjs.utc().format('DD.MM.YYYY'),
                      burn_tx: Array.isArray(burnResult)
                        ? burnResult.map((res) => res?.value?.tx || '')
                        : [burnResult?.tx || ''],
                      project_name: projectName,
                      asset_type: isNotFt ? 'sFT' : 'FT',
                    });
                    setVisibleNftSuccess(true);
                  }
                  return;
                }
                if (fails.length > 0) {
                  ShowAlert.error({
                    message: merged,
                  });
                  return;
                }
              } catch (e) {
                const error = e as Error;
                logger({ message: error?.toString(), type: 'ERROR' });
                if (error?.message === 'ONCHAIN_TIMEOUT') {
                  ShowAlert.error({ message: THROW_EXCEPTION.ONCHAIN_TIMEOUT });
                  return;
                }
                ShowAlert.error({ message: THROW_EXCEPTION.NETWORK_CONGESTED });
              } finally {
                mutate();
                globalMutate([QUERY_KEYS.USER.GET_PROFILE_INFO, publicKey]);
                setName('');
                setProjectType('');
                setProjectLocation('');
                setReason('');
                setAddress('');
                setCountry('');
                setReason('');
                reset();
                onClose();
                setLoading(false);
                ShowAlert.dismiss('loading');
              }
            }}
          >
            {loading ? 'Creating' : 'Create'}
          </DCarbonButton>
        }
        hideCloseButton
        centeredTitle
        classNames={{
          title: 'text-[23px] font-semibold',
          body: 'pt-0 mt-2',
        }}
      >
        <div className="flex flex-col gap-2 items-center mb-2">
          <Tabs
            key="mode"
            variant="light"
            aria-label="Projects Mode"
            classNames={{
              tab: 'h-[49px]',
              cursor: 'shadow-none bg-[#F6F6F6]',
              tabContent:
                'xl:text-[23px] font-medium group-data-[selected=true]:text-[#21272A]',
              tabList: 'p-0',
              panel: 'pt-[16px] pb-0 w-full',
              base: 'sticky top-0 z-50 bg-white',
            }}
            fullWidth
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as TTab)}
          >
            <Tab key="individual" title="Individual">
              <CertificateIndividual
                amount={amount}
                name={name}
                setName={setName}
                isNameInvalid={isNameInvalid}
                setIsNameInvalid={setIsNameInvalid}
                projectType={projectType}
                setProjectType={setProjectType}
                isProjectTypeInvalid={isProjectTypeInvalid}
                setIsProjectTypeInvalid={setIsProjectTypeInvalid}
                projectLocation={projectLocation}
                setProjectLocation={setProjectLocation}
                isProjectLocationInvalid={isProjectLocationInvalid}
                setIsProjectLocationInvalid={setIsProjectLocationInvalid}
                reason={reason}
                setReason={setReason}
                country={country}
                setCountry={setCountry}
                isCountryInvalid={isCountryInvalid}
                setIsCountryInvalid={setIsCountryInvalid}
                loading={loading}
              />
            </Tab>
            <Tab key="corporate" title="Corporation">
              <CertificateCorporate
                amount={amount}
                name={name}
                setName={setName}
                isNameInvalid={isNameInvalid}
                setIsNameInvalid={setIsNameInvalid}
                projectType={projectType}
                setProjectType={setProjectType}
                isProjectTypeInvalid={isProjectTypeInvalid}
                setIsProjectTypeInvalid={setIsProjectTypeInvalid}
                projectLocation={projectLocation}
                setProjectLocation={setProjectLocation}
                isProjectLocationInvalid={isProjectLocationInvalid}
                setIsProjectLocationInvalid={setIsProjectLocationInvalid}
                reason={reason}
                setReason={setReason}
                address={address}
                setAddress={setAddress}
                isAddressInvalid={isAddressInvalid}
                setIsAddressInvalid={setIsAddressInvalid}
                country={country}
                setCountry={setCountry}
                isCountryInvalid={isCountryInvalid}
                setIsCountryInvalid={setIsCountryInvalid}
                loading={loading}
              />
            </Tab>
          </Tabs>
        </div>
      </DCarbonModal>

      {nftSuccessData?.name &&
        nftSuccessData?.burn_tx &&
        nftSuccessData?.burn_tx?.length > 0 &&
        nftSuccessData?.amount && (
          <NftModal
            visible={visibleNftSuccess}
            setVisible={setVisibleNftSuccess}
            name={nftSuccessData?.name}
            burned_at={dayjs.utc().format('DD.MM.YYYY')}
            burn_tx={nftSuccessData?.burn_tx}
            amount={nftSuccessData?.amount.toString()}
            project_name={nftSuccessData?.project_name}
            asset_type={nftSuccessData?.asset_type}
          />
        )}
    </>
  );
}

export default CertificateModal;
