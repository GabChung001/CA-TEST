#!/usr/bin/env python3
# Abre una puerta del DS-K2812 por el SDK de red de Hikvision (puerto 8000),
# sin ISAPI ni relé. Lo llama la API (modo BARRERA_MODO=hik-sdk) en cada acceso
# AUTORIZADO, pasando el rol.
#   python3 abrir-hik.py entrada|salida   -> abre la puerta de ese rol
#   python3 abrir-hik.py test             -> solo login/logout (prueba de conexión)
# Config por entorno (vienen del apps/api/.env de la controladora):
#   HIK_HOST, HIK_PORT, HIK_USER, HIK_PASS,
#   HIK_DOOR_ENTRADA (def 1), HIK_DOOR_SALIDA (def 2), HIK_LIBDIR
# Requisito una sola vez: las librerías del SDK Linux64 en HIK_LIBDIR
#   (ver guias/hardware/DEFINICION-PRUEBAS-HIKVISION.md).
import os, sys, ctypes
from ctypes import (c_char, c_byte, c_int, c_uint, c_ushort, c_char_p,
                    Structure, byref, POINTER, cdll)

LIBDIR = os.environ.get("HIK_LIBDIR", os.path.expanduser("~/hik-sdk/repo/hklib"))

# El loader necesita LD_LIBRARY_PATH apuntando a las .so; re-ejecuta una vez si falta.
if LIBDIR not in os.environ.get("LD_LIBRARY_PATH", ""):
    os.environ["LD_LIBRARY_PATH"] = LIBDIR + ":" + os.environ.get("LD_LIBRARY_PATH", "")
    os.execv(sys.executable, [sys.executable] + sys.argv)

HOST = os.environ.get("HIK_HOST", "192.168.100.64").encode()
PORT = int(os.environ.get("HIK_PORT", "8000"))
USER = os.environ.get("HIK_USER", "admin").encode()
PASS = os.environ.get("HIK_PASS", "").encode()
arg = (sys.argv[1] if len(sys.argv) > 1 else "test").lower()
door = int(os.environ.get("HIK_DOOR_SALIDA", "2")) if arg.startswith("salida") \
       else int(os.environ.get("HIK_DOOR_ENTRADA", "1"))

class NET_DVR_LOCAL_SDK_PATH(Structure):
    _fields_ = [("sPath", c_char * 256), ("byRes", c_byte * 128)]

class NET_DVR_DEVICEINFO_V30(Structure):
    _fields_ = [("sSerialNumber", c_byte * 48), ("byAlarmInPortNum", c_byte),
                ("byAlarmOutPortNum", c_byte), ("byDiskNum", c_byte), ("byDVRType", c_byte),
                ("byChanNum", c_byte), ("byStartChan", c_byte), ("byAudioChanNum", c_byte),
                ("byIPChanNum", c_byte), ("byZeroChanNum", c_byte), ("byMainProto", c_byte),
                ("bySubProto", c_byte), ("bySupport", c_byte), ("bySupport1", c_byte),
                ("bySupport2", c_byte), ("wDevType", c_ushort), ("bySupport3", c_byte),
                ("byMultiStreamProto", c_byte), ("byStartDChan", c_byte), ("byStartDTalkChan", c_byte),
                ("byHighDChanNum", c_byte), ("bySupport4", c_byte), ("byLanguageType", c_byte),
                ("byVoiceInChanNum", c_byte), ("byStartVoiceInChanNo", c_byte), ("byRes3", c_byte * 2),
                ("byMirrorChanNum", c_byte), ("wStartMirrorChanNo", c_ushort), ("byRes2", c_byte * 2)]

class NET_DVR_CONTROL_GATEWAY(Structure):
    _fields_ = [("dwSize", c_uint), ("dwGatewayIndex", c_uint), ("byCommand", c_byte),
                ("byLockType", c_byte), ("wLockID", c_ushort), ("byControlSrc", c_byte * 32),
                ("byControlType", c_byte), ("byRes3", c_byte * 3), ("byRes2", c_byte * 256)]

sdk = cdll.LoadLibrary(os.path.join(LIBDIR, "libhcnetsdk.so"))

if not sdk.NET_DVR_Init():
    print("ERROR NET_DVR_Init"); sys.exit(2)
try:
    cfg = NET_DVR_LOCAL_SDK_PATH(); cfg.sPath = LIBDIR.encode()
    sdk.NET_DVR_SetSDKInitCfg(2, byref(cfg))  # ruta de los componentes HCNetSDKCom
except Exception:
    pass

sdk.NET_DVR_Login_V30.restype = c_int
sdk.NET_DVR_Login_V30.argtypes = [c_char_p, c_ushort, c_char_p, c_char_p,
                                  POINTER(NET_DVR_DEVICEINFO_V30)]
sdk.NET_DVR_GetLastError.restype = c_uint

dev = NET_DVR_DEVICEINFO_V30()
uid = sdk.NET_DVR_Login_V30(HOST, PORT, USER, PASS, byref(dev))
if uid < 0:
    print("LOGIN FALLO err=%d" % sdk.NET_DVR_GetLastError()); sys.exit(3)
print("LOGIN OK (uid=%d, devType=%d)" % (uid, dev.wDevType))

rc = 0
if arg != "test":
    opened = False
    # CONTROLADOR DE ACCESO: NET_DVR_ControlGateway(uid, puerta, estado)
    #   estado: 0=cerrar 1=abrir 2=siempre abierta 3=siempre cerrada
    try:
        sdk.NET_DVR_ControlGateway.restype = c_int
        sdk.NET_DVR_ControlGateway.argtypes = [c_int, c_int, c_uint]
        if sdk.NET_DVR_ControlGateway(uid, door, 1):
            print("ABIERTA puerta %d por ControlGateway (%s)" % (door, arg)); opened = True
        else:
            print("ControlGateway err=%d" % sdk.NET_DVR_GetLastError())
    except Exception as e:
        print("ControlGateway no disponible: %s" % e)
    if not opened and door >= 1:  # algunos firmwares usan indice base-0
        try:
            if sdk.NET_DVR_ControlGateway(uid, door - 1, 1):
                print("ABIERTA puerta idx %d (base-0)" % (door - 1)); opened = True
            else:
                print("ControlGateway(base-0) err=%d" % sdk.NET_DVR_GetLastError())
        except Exception:
            pass
    if not opened:  # fallback videoportero
        gw = NET_DVR_CONTROL_GATEWAY(); gw.dwSize = ctypes.sizeof(NET_DVR_CONTROL_GATEWAY)
        gw.dwGatewayIndex = door; gw.byCommand = 1; gw.byControlType = 1
        for i, b in enumerate(b"ThinkTech"):
            gw.byControlSrc[i] = b
        sdk.NET_DVR_RemoteControl.restype = c_int
        if sdk.NET_DVR_RemoteControl(uid, 16009, byref(gw), gw.dwSize):
            print("ABIERTA puerta %d por RemoteControl (%s)" % (door, arg)); opened = True
        else:
            print("RemoteControl err=%d" % sdk.NET_DVR_GetLastError())
    if not opened:
        rc = 4

sdk.NET_DVR_Logout_V30(uid)
sdk.NET_DVR_Cleanup()
sys.exit(rc)
