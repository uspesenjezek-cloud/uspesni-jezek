param(
  [Parameter(Mandatory = $true)][string]$DllPath,
  [Parameter(Mandatory = $true)][string]$ModelPath,
  [string]$Language = "de-DE"
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-ProtocolJson([hashtable]$Value) {
  [Console]::Out.WriteLine(($Value | ConvertTo-Json -Compress -Depth 10))
  [Console]::Out.Flush()
}

function ConvertFrom-NativeUtf8([IntPtr]$Pointer, [UInt64]$Length = 0) {
  if ($Pointer -eq [IntPtr]::Zero) { return "" }
  if ($Length -eq 0) {
    while ([Runtime.InteropServices.Marshal]::ReadByte($Pointer, [int]$Length) -ne 0) { $Length++ }
  }
  if ($Length -eq 0) { return "" }
  $bytes = [byte[]]::new([int]$Length)
  [Runtime.InteropServices.Marshal]::Copy($Pointer, $bytes, 0, [int]$Length)
  return [Text.Encoding]::UTF8.GetString($bytes)
}

function ConvertTo-NativeUtf8([string]$Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value + [char]0)
  $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pointer, $bytes.Length)
  return $pointer
}

$resolvedDll = (Resolve-Path -LiteralPath $DllPath).Path
$resolvedModel = (Resolve-Path -LiteralPath $ModelPath).Path
$escapedDll = $resolvedDll.Replace("\", "\\").Replace('"', '\"')
$nativeSource = @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct TranscribeRunParamsV013 {
  public UInt64 struct_size;
  public Int32 task;
  public Int32 timestamps;
  public Int32 pnc;
  public Int32 itn;
  public IntPtr language;
  public IntPtr target_language;
  [MarshalAs(UnmanagedType.I1)] public bool keep_special_tags;
  public IntPtr family;
  public Int32 spec_k_drafts;
}

[StructLayout(LayoutKind.Sequential)]
public struct TranscribeRunParamsV020 {
  public UInt64 struct_size;
  public Int32 task;
  public Int32 timestamps;
  public Int32 pnc;
  public Int32 itn;
  public Int32 diarize;
  public IntPtr language;
  public IntPtr target_language;
  [MarshalAs(UnmanagedType.I1)] public bool keep_special_tags;
  public IntPtr family;
  public Int32 spec_k_drafts;
}

[StructLayout(LayoutKind.Sequential)]
public struct TranscribeStreamParams {
  public UInt64 struct_size;
  public IntPtr family;
  public Int32 commit_policy;
  public UInt32 stable_prefix_agreement_n;
}

[StructLayout(LayoutKind.Sequential)]
public struct TranscribeStreamText {
  public UInt64 struct_size;
  public IntPtr full_text;
  public UInt64 full_text_bytes;
  public IntPtr committed_text;
  public UInt64 committed_text_bytes;
  public IntPtr tentative_text;
  public UInt64 tentative_text_bytes;
  public UInt64 raw_tentative_start_bytes;
}

public static class NemotronNative {
  private const string Dll = "$escapedDll";
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_version")]
  public static extern IntPtr Version();
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_init_backends_default")]
  public static extern Int32 InitBackendsDefault();
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_open")]
  public static extern Int32 Open([MarshalAs(UnmanagedType.LPUTF8Str)] string model, IntPtr loadParams, IntPtr sessionParams, out IntPtr session);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_session_free")]
  public static extern void SessionFree(IntPtr session);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_status_string")]
  public static extern IntPtr StatusString(Int32 status);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_run_params_init")]
  public static extern void RunParamsInitV013(ref TranscribeRunParamsV013 value);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_run_params_init")]
  public static extern void RunParamsInitV020(ref TranscribeRunParamsV020 value);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_params_init")]
  public static extern void StreamParamsInit(ref TranscribeStreamParams value);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_begin")]
  public static extern Int32 StreamBeginV013(IntPtr session, ref TranscribeRunParamsV013 runParams, ref TranscribeStreamParams streamParams);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_begin")]
  public static extern Int32 StreamBeginV020(IntPtr session, ref TranscribeRunParamsV020 runParams, ref TranscribeStreamParams streamParams);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_feed")]
  public static extern Int32 StreamFeed(IntPtr session, [In] float[] pcm, Int32 samples, IntPtr update);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_finalize")]
  public static extern Int32 StreamFinalize(IntPtr session, IntPtr update);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_reset")]
  public static extern void StreamReset(IntPtr session);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_text_init")]
  public static extern void StreamTextInit(ref TranscribeStreamText value);
  [DllImport(Dll, CallingConvention = CallingConvention.Cdecl, EntryPoint = "transcribe_stream_get_text")]
  public static extern Int32 StreamGetText(IntPtr session, ref TranscribeStreamText value);
}
"@
Add-Type -TypeDefinition $nativeSource -Language CSharp

function Get-StatusMessage([int]$Status) {
  $message = ConvertFrom-NativeUtf8 ([NemotronNative]::StatusString($Status))
  return $(if ($message) { $message } else { "Napaka transcribe.cpp ($Status)." })
}

function Confirm-Status([int]$Status, [string]$Action) {
  if ($Status -ne 0) { throw "$Action`: $(Get-StatusMessage $Status)" }
}

function Get-StreamText([IntPtr]$Session) {
  $snapshot = [TranscribeStreamText]::new()
  [NemotronNative]::StreamTextInit([ref]$snapshot)
  Confirm-Status ([NemotronNative]::StreamGetText($Session, [ref]$snapshot)) "Branje pretočnega prepisa ni uspelo"
  return @{
    fullText = ConvertFrom-NativeUtf8 $snapshot.full_text $snapshot.full_text_bytes
    committedText = ConvertFrom-NativeUtf8 $snapshot.committed_text $snapshot.committed_text_bytes
    tentativeText = ConvertFrom-NativeUtf8 $snapshot.tentative_text $snapshot.tentative_text_bytes
  }
}

$session = [IntPtr]::Zero
$streamActive = $false
try {
  Confirm-Status ([NemotronNative]::InitBackendsDefault()) "Nalaganje lokalnega pospeševalnika ni uspelo"
  Confirm-Status ([NemotronNative]::Open($resolvedModel, [IntPtr]::Zero, [IntPtr]::Zero, [ref]$session)) "Nemotrona 3.5 ni bilo mogoče naložiti"
  $runtimeVersion = ConvertFrom-NativeUtf8 ([NemotronNative]::Version())
  Write-ProtocolJson @{ event = "ready"; model = [IO.Path]::GetFileName($resolvedModel); language = $Language; runtime = $runtimeVersion }

  while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $request = $null
    try {
      $request = $line | ConvertFrom-Json
      switch ($request.command) {
        "start" {
          if ($streamActive) { [NemotronNative]::StreamReset($session); $streamActive = $false }
          $languagePointer = ConvertTo-NativeUtf8 $Language
          try {
            $stream = [TranscribeStreamParams]::new()
            [NemotronNative]::StreamParamsInit([ref]$stream)
            if ($runtimeVersion.StartsWith("0.2.")) {
              $runV020 = [TranscribeRunParamsV020]::new()
              [NemotronNative]::RunParamsInitV020([ref]$runV020)
              $runV020.language = $languagePointer
              Confirm-Status ([NemotronNative]::StreamBeginV020($session, [ref]$runV020, [ref]$stream)) "Nemške pretočne seje ni bilo mogoče ustvariti"
            } else {
              $runV013 = [TranscribeRunParamsV013]::new()
              [NemotronNative]::RunParamsInitV013([ref]$runV013)
              $runV013.language = $languagePointer
              Confirm-Status ([NemotronNative]::StreamBeginV013($session, [ref]$runV013, [ref]$stream)) "Nemške pretočne seje ni bilo mogoče ustvariti"
            }
          } finally {
            [Runtime.InteropServices.Marshal]::FreeHGlobal($languagePointer)
          }
          $streamActive = $true
          $result = @{ fullText = ""; committedText = ""; tentativeText = "" }
        }
        "feed" {
          if (-not $streamActive) { throw "Nemška pretočna seja ni zagnana." }
          $bytes = [Convert]::FromBase64String([string]$request.pcm)
          if (($bytes.Length % 4) -ne 0) { throw "PCM paket nima veljavne Float32 dolžine." }
          $samples = [single[]]::new([int]($bytes.Length / 4))
          [Buffer]::BlockCopy($bytes, 0, $samples, 0, $bytes.Length)
          Confirm-Status ([NemotronNative]::StreamFeed($session, $samples, $samples.Length, [IntPtr]::Zero)) "Nemotron ni obdelal zvočnega paketa"
          $result = Get-StreamText $session
        }
        "stop" {
          if (-not $streamActive) { $result = @{ fullText = ""; committedText = ""; tentativeText = "" } }
          else {
            Confirm-Status ([NemotronNative]::StreamFinalize($session, [IntPtr]::Zero)) "Nemotron ni zaključil prepisa"
            $result = Get-StreamText $session
            $streamActive = $false
          }
        }
        default { throw "Neznan ukaz Nemotron procesa." }
      }
      Write-ProtocolJson @{ id = [int]$request.id; ok = $true; result = $result }
    } catch {
      if ($streamActive) { [NemotronNative]::StreamReset($session); $streamActive = $false }
      $id = if ($request -and $request.id) { [int]$request.id } else { 0 }
      Write-ProtocolJson @{ id = $id; ok = $false; error = $_.Exception.Message }
    }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
} finally {
  if ($session -ne [IntPtr]::Zero) { [NemotronNative]::SessionFree($session) }
}
