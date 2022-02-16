import type { BaseAddress, Ed25519KeyHash, NativeScript, NativeScripts, NetworkInfo, ScriptHash } from '@emurgo/cardano-serialization-lib-browser'

type CardanoWASM = typeof import('@emurgo/cardano-serialization-lib-browser')

class Cardano {
  private _wasm: CardanoWASM

  public constructor(wasm: CardanoWASM) {
    this._wasm = wasm
  }

  public getBech32AddressKeyHash(bech32Address: string): Ed25519KeyHash {
    const { Address, BaseAddress } = this._wasm
    const address = Address.from_bech32(bech32Address)
    const keyHash = BaseAddress.from_address(address)?.payment_cred().to_keyhash()

    if (!keyHash) {
      throw new Error('failed to get keyhash from address')
    }

    return keyHash
  }

  public buildPublicKeyScript(keyHash: Ed25519KeyHash): NativeScript {
    const { ScriptPubkey, NativeScript } = this._wasm
    return NativeScript.new_script_pubkey(ScriptPubkey.new(keyHash));
  }

  public buildAllScript(scripts: NativeScript[]): NativeScript {
    const { ScriptAll, NativeScript } = this._wasm
    return NativeScript.new_script_all(ScriptAll.new(this.buildNativeScripts(scripts)))
  }

  public buildNativeScripts(scripts: NativeScript[]): NativeScripts {
    const { NativeScripts } = this._wasm
    const nativeScripts = NativeScripts.new()
    scripts.forEach((script) => {
      nativeScripts.add(script)
    })
    return nativeScripts
	}

  public getScriptHash(script: NativeScript): ScriptHash {
    const { ScriptHashNamespace } = this._wasm
    return script.hash(ScriptHashNamespace.NativeScript)
  }

  public getScriptHashBaseAddress(scriptHash: ScriptHash, networkInfo: NetworkInfo): BaseAddress {
    const { BaseAddress, StakeCredential } = this._wasm
    const networkId = networkInfo.network_id()
    const credential = StakeCredential.from_scripthash(scriptHash)
    return BaseAddress.new(networkId, credential, credential)
  }

  public getScriptBech32Address(script: NativeScript, isMainnet: boolean): string {
    const { NetworkInfo } = this._wasm
    const networkInfo = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()
    const scriptHash = this.getScriptHash(script)
    return this.getScriptHashBaseAddress(scriptHash, networkInfo).to_address().to_bech32()
  }
}

class Factory {
  private _instance?: Cardano

  public get instance() {
    return this._instance
  }

  public async load() {
    if (!this.instance)
      this._instance = new Cardano(await import('@emurgo/cardano-serialization-lib-browser'))
    return this.instance
  }
}

const CardanoSerializationLib = new Factory()

export type { Cardano }
export { CardanoSerializationLib }