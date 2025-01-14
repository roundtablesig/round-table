import type { NextPage } from 'next'
import type { FC, ReactNode } from 'react'
import { useState, KeyboardEventHandler, ChangeEventHandler, FocusEventHandler, useEffect, useContext, MouseEventHandler } from 'react'
import { Hero, Layout, Panel } from '../../components/layout'
import { getResult, isAddressNetworkCorrect, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano, MultiSigType } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import type { Ed25519KeyHash, NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { ExclamationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid'
import { SaveTreasuryButton } from '../../components/transaction'
import { ConfigContext } from '../../cardano/config'
import { nanoid } from 'nanoid'
import Modal from '../../components/modal'
import { Calendar, DateContext } from '../../components/time'
import { estimateDateBySlot, estimateSlotByDate } from '../../cardano/utils'
import { NativeScriptViewer } from '../../components/native-script'

type KeyHashInput = {
  id: string
  address?: string
  hash: Ed25519KeyHash
}

const TimeLockInput: FC<{
  label: string
  className?: string
  children: ReactNode
  isEnabled: boolean
  setIsEnabled: (_: boolean) => void
  value: number
  setValue: (_: number) => void
  isLocked: (_: Date) => boolean
}> = ({ className, children, label, isEnabled, setIsEnabled, value, setValue, isLocked }) => {
  const [config, _] = useContext(ConfigContext)
  const date = estimateDateBySlot(value, config.isMainnet)
  return (
    <div className={className}>
      <label className='space-x-1'>
        <span>{label}</span>
        <input
          type='checkbox'
          checked={isEnabled}
          onChange={() => setIsEnabled(!isEnabled)} />
      </label>
      {isEnabled && <>
        {children}
        <NumberInput className='block w-full p-2 border rounded' min={0} step={1000} value={value} onCommit={setValue} />
        <Calendar isRed={isLocked} selectedDate={date} onChange={(date) => setValue(estimateSlotByDate(date, config.isMainnet))} />
      </>}
    </div>
  )
}

const TimeLockInputs: FC<{
  className?: string
  isTimelockStart: boolean
  setIsTimelockStart: (_: boolean) => void
  timelockStart: number
  setTimelockStart: (_: number) => void
  isTimelockExpiry: boolean
  setIsTimelockExpiry: (_: boolean) => void
  timelockExpiry: number
  setTimelockExpiry: (_: number) => void
}> = ({ className, isTimelockStart, setIsTimelockStart, timelockStart, setTimelockStart, isTimelockExpiry, setIsTimelockExpiry, timelockExpiry, setTimelockExpiry }) => {
  const [now, _t] = useContext(DateContext)

  return (
    <div className={className}>
      <div className='grid sm:gap-2 md:grid-cols-2 md:gap-4'>
        <TimeLockInput
          isLocked={(date) => date <= now}
          className='space-y-1'
          value={timelockExpiry}
          setValue={setTimelockExpiry}
          label='Expiry Slot'
          isEnabled={isTimelockExpiry}
          setIsEnabled={setIsTimelockExpiry}>
          <div className='p-2 rounded bg-red-700 text-white'>
            <h6 className='flex font-semibold space-x-1 items-center'>
              <ExclamationCircleIcon className='w-4' />
              <span>WARNING</span>
            </h6>
            <p>Be careful with this option. It returns false after the slot/time is passed which could lead to coins locked/burned forever when it is combined with All policy and At Least policy or used alone.</p>
          </div>
        </TimeLockInput>
        <TimeLockInput
          isLocked={() => false}
          className='space-y-1'
          value={timelockStart}
          setValue={setTimelockStart}
          label='Start Slot'
          isEnabled={isTimelockStart}
          setIsEnabled={setIsTimelockStart}>
          <div className='p-2 rounded bg-red-700 text-white'>
            <h6 className='flex font-semibold space-x-1 items-center'>
              <ExclamationCircleIcon className='w-4' />
              <span>WARNING</span>
            </h6>
            <p>Be careful with this option. It returns false before the slot/time is reached. You might not want to wait too long to unlock it.</p>
          </div>
        </TimeLockInput>
      </div>
    </div>
  )
}

const AddAddress: FC<{
  cardano: Cardano
  onAdd: (_: KeyHashInput) => void
  onCancel: () => void
}> = ({ cardano, onAdd, onCancel }) => {
  const [address, setAddress] = useState('')
  const [config, _] = useContext(ConfigContext)

  const result = getResult(() => {
    const addressObject = cardano.lib.Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('Wrong network')
    return addressObject.as_base()?.payment_cred().to_keyhash()
  })

  const isValid = result.isOk && !!result.data

  const submit = () => {
    if (result.isOk && result.data) {
      onAdd({ id: nanoid(), address, hash: result.data })
    }
  }

  const cancelHandle: MouseEventHandler<HTMLButtonElement> = () => {
    onCancel()
  }

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.shiftKey == false && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className='space-y-2'>
      <label className='space-y-1'>
        <div className="after:content-['*'] after:text-red-500">New Signer</div>
        <textarea
          className={['block w-full border p-2 rounded', isValid ? '' : 'text-red-500'].join(' ')}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={enterPressHandle}
          rows={4}
          value={address}
          placeholder="Add signer address and press enter">
        </textarea>
      </label>
      <nav className='flex justify-end space-x-2'>
        <button
          onClick={cancelHandle}
          className='border rounded p-2 text-sky-700'>
          Cancel
        </button>
        <button
          disabled={!isValid}
          onClick={submit}
          className='flex py-2 px-4 items-center space-x-1 rounded text-white bg-sky-700 disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          <PlusIcon className='h-4' />
          <span>Add Address</span>
        </button>
      </nav>
    </div>
  )
}

const NumberInput: FC<{
  step?: number
  min?: number
  max?: number
  className?: string
  value: number
  onCommit: (_: number) => void
}> = ({ className, min, max, step, value, onCommit }) => {
  const [localValue, setLocalValue] = useState(value.toString())

  useEffect(() => {
    let isMounted = true

    isMounted && setLocalValue(value.toString())

    return () => {
      isMounted = false
    }
  }, [value])

  const changeHandle: ChangeEventHandler<HTMLInputElement> = (event) => {
    setLocalValue(event.target.value)
  }

  const blurHandle: FocusEventHandler<HTMLInputElement> = () => {
    const parsedValue = parse(localValue)
    if (isNaN(parsedValue)) {
      setLocalValue(value.toString())
    } else {
      setLocalValue(parsedValue.toString())
      onCommit(parsedValue)
    }
  }

  const keyPressHandle: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!/[0-9]/.test(event.code)) {
      event.preventDefault()
    }
  }

  function parse(input: string): number {
    const parsedValue = parseInt(input)

    if (min && parsedValue < min) return min
    if (max && parsedValue > max) return max
    return parsedValue
  }

  return (
    <input
      type='number'
      className={className}
      value={localValue}
      onChange={changeHandle}
      onBlur={blurHandle}
      onKeyPress={keyPressHandle}
      min={min} max={max} step={step} />
  )
}

const RequiredNumberInput: FC<{
  className?: string
  max: number
  required: number
  onCommit: (_: number) => void
}> = ({ className, required, max, onCommit }) => {
  return (
    <NumberInput
      className={className}
      value={required}
      step={1}
      min={1}
      max={max}
      onCommit={onCommit} />
  )
}

const KeyHashList: FC<{
  className?: string
  keyHashInputs: KeyHashInput[]
  deleteKeyHashInput: (keyHashHex: string) => void
}> = ({ className, keyHashInputs, deleteKeyHashInput }) => {
  if (keyHashInputs.length <= 0) return null

  return (
    <div className={className}>
      <div>Signers</div>
      <ul className='border divide-y rounded'>
        {keyHashInputs.map(({ id, address, hash }) => {
          return (
            <li key={id} className='flex items-center p-2'>
              <div className='grow'>
                <div>{hash.to_hex()}</div>
                <div className='text-sm truncate'>{address}</div>
              </div>
              <button className='p-2'>
                <TrashIcon className='w-4' onClick={() => deleteKeyHashInput(id)} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const NewTreasury: NextPage = () => {
  const [keyHashInputs, setKeyHashInputs] = useState<KeyHashInput[]>([])
  const [scriptType, setScriptType] = useState<MultiSigType>('all')
  const [required, setRequired] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [config, _] = useContext(ConfigContext)
  const currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)
  const currentSlot = estimateSlotByDate(currentDate, config.isMainnet)
  const [isTimelockStart, setIsTimelockStart] = useState(false)
  const [timelockStart, setTimelockStart] = useState(currentSlot)
  const [isTimelockExpiry, setIsTimelockExpiry] = useState(false)
  const [timelockExpiry, setTimelockExpiry] = useState(currentSlot)
  const cardano = useCardanoMultiplatformLib()
  if (!cardano) return <Loading />;

  const { NativeScript, NativeScripts, ScriptPubkey, ScriptAll, ScriptAny, ScriptNOfK, TimelockStart, TimelockExpiry, BigNum } = cardano.lib

  const scripts = NativeScripts.new()

  keyHashInputs.forEach((input) => {
    const script = NativeScript.new_script_pubkey(ScriptPubkey.new(input.hash))
    scripts.add(script)
    return
  })

  if (isTimelockStart) {
    const slot = BigNum.from_str(timelockStart.toString())
    const script = NativeScript.new_timelock_start(TimelockStart.new(slot))
    scripts.add(script)
  }

  if (isTimelockExpiry) {
    const slot = BigNum.from_str(timelockExpiry.toString())
    const script = NativeScript.new_timelock_expiry(TimelockExpiry.new(slot))
    scripts.add(script)
  }

  const getScript = (): NativeScript | undefined => {
    if (scripts.len() < 1) return

    switch (scriptType) {
      case 'all': return NativeScript.new_script_all(ScriptAll.new(scripts))
      case 'any': return NativeScript.new_script_any(ScriptAny.new(scripts))
      case 'atLeast': return NativeScript.new_script_n_of_k(ScriptNOfK.new(required, scripts))
    }
  }

  const script = getScript()

  const closeModal = () => setIsModalOpen(false)

  const addKeyHashInput = (keyHashInput: KeyHashInput) => {
    setKeyHashInputs(keyHashInputs.concat(keyHashInput))
    closeModal()
  }

  const deleteKeyHashInput = (id: string) => {
    setKeyHashInputs(keyHashInputs.filter((keyHashInput) => id !== keyHashInput.id))
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>New Treasury</h1>
          <p>Start to create a treasury protected by Multi-Sig native scripts from here by adding signer addresses or by setting timelocks. Only receiving addresses from one of our supported wallets should be used. Check the homepage for further information.</p>
        </Hero>
        <Panel>
          <div className='p-4 space-y-4'>
            <label className='block space-y-1'>
              <div className="after:content-['*'] after:text-red-500">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='p-2 block border w-full rounded'
                placeholder='Write Name' />
            </label>
            <label className='block space-y-1'>
              <div>Description</div>
              <textarea
                className='p-2 block border w-full rounded'
                placeholder='Describe the treasury'
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}>
              </textarea>
            </label>
            <KeyHashList className='space-y-1' keyHashInputs={keyHashInputs} deleteKeyHashInput={deleteKeyHashInput} />
            <nav>
              <button
                onClick={() => setIsModalOpen(true)}
                className='flex text-sky-700 items-center space-x-1 border rounded p-2'>
                <PlusIcon className='w-4' />
                <span>Add signer</span>
              </button>
            </nav>
            <TimeLockInputs
              timelockStart={timelockStart}
              setTimelockStart={setTimelockStart}
              isTimelockStart={isTimelockStart}
              setIsTimelockStart={setIsTimelockStart}
              timelockExpiry={timelockExpiry}
              setTimelockExpiry={setTimelockExpiry}
              isTimelockExpiry={isTimelockExpiry}
              setIsTimelockExpiry={setIsTimelockExpiry} />
            {scripts.len() > 0 && <>
              <div className='space-y-1'>
                <div>Required Signers or Timelocks</div>
                <div className='flex space-x-2 items-center'>
                  <select className='bg-white border rounded text-sm p-2' onChange={(e) => setScriptType(e.target.value as MultiSigType)}>
                    <option value="all">All</option>
                    <option value="any">Any</option>
                    <option value="atLeast">At least</option>
                  </select>
                  {scriptType == 'atLeast' &&
                    <RequiredNumberInput
                      className='border rounded p-1'
                      max={scripts.len()}
                      required={required}
                      onCommit={setRequired} />
                  }
                  <div className='p-2 space-x-1'>
                    <span>of</span>
                    <span>{scripts.len()}</span>
                  </div>
                </div>
              </div>
            </>}
            {script && <>
              <div className='space-y-1'>
                <div>Script Preview</div>
                <NativeScriptViewer
                  verifyingData={{ signatures: new Map(), currentSlot }}
                  className='p-2 border rounded space-y-2'
                  headerClassName='font-semibold'
                  ulClassName='space-y-1'
                  nativeScript={script} />
              </div>
            </>}
          </div>
          <footer className='flex justify-end p-4 bg-gray-100'>
            <SaveTreasuryButton
              className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
              name={name}
              description={description}
              script={script}>
              Save Treasury
            </SaveTreasuryButton>
          </footer>
        </Panel>
      </div>
      <Modal
        className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3'
        isOpen={isModalOpen}
        onClose={closeModal}>
        <AddAddress cardano={cardano} onAdd={addKeyHashInput} onCancel={closeModal} />
      </Modal>
    </Layout>
  )
}

export default NewTreasury
