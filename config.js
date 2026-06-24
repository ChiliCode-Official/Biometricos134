// CONFIGURACIÓN CENTRAL DE LA APLICACIÓN DE BIOMÉTRICOS (NOTARÍA 134)

const CONFIG = {
  // Pegar aquí la URL de la Web App obtenida de Google Apps Script.
  // Ejemplo: "https://script.google.com/macros/s/AKfycbz.../exec"
  // Si está vacío, la app funcionará en modo DEMO (LocalStorage local).
  GOOGLE_SHEET_API_URL: "https://script.google.com/macros/s/AKfycbwpjVhgT2AgcMPwHgckMlYpEQeO7NfVAP-YKQrlZniDEM1BC-S6d2sqQNLNFXwXi2PwxA/exec", 

  // PIN de Acceso para el Administrador
  ADMIN_PIN: "134134",

  // Datos precargados de los 8 Biométricos (Extraídos del Excel original)
  BIOMETRICOS: [
    {
      biometrico: 1,
      bam_telefono: "55 13 92 13 97",
      internet_plan: "928 mg hasta el 26/10/2024",
      laptop_marca: "HP",
      laptop_modelo: "EliteBook 840 CORE I5",
      laptop_serie: "5CG5502662",
      impresora_marca: "HP",
      impresora_modelo: "OfficeJet 200",
      impresora_serie: "TH118950DH",
      biometrico_lector: "U.are.U 5300",
      biometrico_serie: "N902C300771",
      router_modelo: "4G LTE",
      router_imei: "IMEI:865298031325378"
    },
    {
      biometrico: 2,
      bam_telefono: "55 37 16 67 30",
      internet_plan: "",
      laptop_marca: "LENOVO",
      laptop_modelo: "IdeaPad S145",
      laptop_serie: "PF2Y20EN",
      impresora_marca: "HP",
      impresora_modelo: "OFFICE JET 200",
      impresora_serie: "TH118950JF",
      biometrico_lector: "U.are.U",
      biometrico_serie: "N902C300772",
      router_modelo: "4G ELITE",
      router_imei: "865298031325593"
    },
    {
      biometrico: 3,
      bam_telefono: "55 21 12 29 45",
      internet_plan: "742 mb",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG1436JCV",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007540",
      biometrico_lector: "HID Digital Personal 4500",
      biometrico_serie: "P52E10517",
      router_modelo: "4G LTE",
      router_imei: "866645058868022"
    },
    {
      biometrico: 4,
      bam_telefono: "55 74 82 60 26",
      internet_plan: "",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG1436JCC",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007600",
      biometrico_lector: "HID",
      biometrico_serie: "olt_6_10518",
      router_modelo: "4G ELITE",
      router_imei: "866645058868410"
    },
    {
      biometrico: 5,
      bam_telefono: "55 22 99 60 18",
      internet_plan: "",
      laptop_marca: "HP 240 G8",
      laptop_modelo: "CORE I5",
      laptop_serie: "5CG1320D09",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007063",
      biometrico_lector: "HID (P52E10600)",
      biometrico_serie: "olt_10_10600",
      router_modelo: "4G LTE",
      router_imei: "IMEI:866645058867610"
    },
    {
      biometrico: 6,
      bam_telefono: "55 61 55 38 52",
      internet_plan: "1.99 Gb",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG61320BN2",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007514",
      biometrico_lector: "HID (P520E10597)",
      biometrico_serie: "olt_7_10597",
      router_modelo: "4G LT",
      router_imei: "866645058867289"
    },
    {
      biometrico: 7,
      bam_telefono: "55 47 85 81 57",
      internet_plan: "331 mb",
      laptop_marca: "HP",
      laptop_modelo: "ProBook 440 G8",
      laptop_serie: "5CD21752QG",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007948",
      biometrico_lector: "HID",
      biometrico_serie: "P520E10598",
      router_modelo: "4G LTE",
      router_imei: "866645058867354"
    },
    {
      biometrico: 8,
      bam_telefono: "55 49 16 78 44",
      internet_plan: "",
      laptop_marca: "HP",
      laptop_modelo: "ProBook 640 G2",
      laptop_serie: "5GC7192GQM",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK005642",
      biometrico_lector: "HID",
      biometrico_serie: "P520E10599",
      router_modelo: "4G LTE (Genérico)",
      router_imei: "866645058867321"
    }
  ],

  // Listado de usuarios autorizados precargado del Excel
  USUARIOS: [
    "ALDO CONTRERAS GARCIA",
    "ALBERTO OROZCO VILALVA",
    "ALEJANDRO CRUZ HERNANDEZ",
    "ALAN GARCIA NOLASCO",
    "ANABEL FLORES PLATA",
    "CESAR RODRIGO GONZALEZ RUIZ",
    "CECILIA ROMAN",
    "DANIEL BASILIO",
    "DANIEL EMILIANO ROJAS MORALES",
    "DIEGO LINARES ALVAREZ",
    "DONOVAN ALVAREZ LOPEZ",
    "EMILIO GARCIA CIELO",
    "EMILIANO TOVAR ROMERO",
    "EUNICE VANESSA DOMINGUEZ MARTINEZ",
    "FRIDA VALENTINA BECERRA VILLEGAS",
    "GABRIEL SANCHEZ DAVILA",
    "GISELL CONTRERAS",
    "HUGO ZAID ARTEAGA JIMENEZ",
    "ISAI ZUÑIGA GARCIA",
    "JESSICA RODRIGUEZ RANGEL",
    "JACOB DORANTES RANGEL",
    "JIMENA BARRON FLORES",
    "JORGE ISAIAS RIVAS IBARRA",
    "JULIETA AYLIN FUENTES PEDRAZA",
    "KAREN MONTES DE OCA PEREZ",
    "KARLA GOMEZ PERALTA",
    "KARLA IRERI MEDINA ROJAS",
    "LUIS ALEJANDRO",
    "LUISA FERNANDA VELAZQUEZ V.",
    "MANUEL ALEJANDRO GUTIERREZ MORAN",
    "MARIO ALBERTO MONDRAGON MORALES",
    "MARIANO JAHEN HERNANDEZ",
    "MILTON FEDERICO VEGA ARTEAGA",
    "MIREYA PACHECO",
    "MONICA ELIZABETH TABLEROS TEJEIDA",
    "MONSERRAT ROMERO BORJA",
    "PAOLA ROSSLEY MADARIAGA",
    "PAULO CESAR NEGRETE",
    "PATRICIO BARRON CAMACHO",
    "ROXANA RAMIREZ HDZ",
    "ROBERTO CARLOS CISNEROS G.",
    "ROGER ROGELIO RAMIREZ ALVARADO",
    "SILVIA ESQUIVEL",
    "STEEF ALEXIS HERNANDEZ VAZQUEZ",
    "SUJEY GONZALEZ",
    "VALERIA ALEJANDRA CARRILLO GORDILLO",
    "VIRIDIANA GARCIA HERNANDEZ",
    "XIMENA ANGELES HERNANDEZ",
    "YAIR ALEXIS GARCÍA RAMÍREZ",
    "YADIRA BERNAL",
    "YAREMI JOCELIN MONDRAGON GARCIA",
    "YEIDCKOL DANIELA VEGA RIVERO",
    "ZYANYA MONSERRAT VIDRIO G"
  ]
};

// Exportar configuración para navegadores (compatible con ES Modules o script global)
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}
