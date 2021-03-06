import { Component, OnInit } from '@angular/core';
import { ParserService } from '../../services/parser/parser.service';
import { CpuService } from '../../services/cpu/cpu.service';
import { UtilsService } from '../../services/utils/utils.service';
import { MemoryService } from '../../services/memory/memory.service';
import { Line } from '../../models/Line';
import { AddressLine } from "../../models/AddressLine";
import { F, D, E, M, W } from "../../models/PipeReg";
import Long from 'long';

@Component({
  selector: 'app-control',
  templateUrl: './control.component.html',
  styleUrls: ['./control.component.css']
})
export class ControlComponent implements OnInit {
  fileContent: Line[];
  cycle: number;
  instructionLength: number;
  stop: boolean;
  counterStop: boolean;
  loadComponent: boolean;
  isFirstAddressCurrent: boolean;
  showSelectFile: boolean;
  uploadButtonText: string;
  reset: boolean;
  eof: boolean;

  dstall: boolean;
  dbubble: boolean;

  freg: F;
  dreg: D;
  ereg: E;
  mreg: M;
  wreg: W;

  constructor(private parserService: ParserService,
    private cpuService: CpuService,
    private utilsService: UtilsService,
    private memoryService: MemoryService) {
  }

  ngOnInit() {
    this.cycle = 0;
    this.stop = false;
    this.counterStop = false;
    this.loadComponent = false;
    this.isFirstAddressCurrent = false;
    this.instructionLength = 0;
    this.showSelectFile = false;
    this.reset = false;
    this.eof = false;
    this.uploadButtonText = "Upload a file";

    this.freg = new F();
    this.dreg = new D();
    this.ereg = new E();
    this.mreg = new M();
    this.wreg = new W();
  }

  /*
  * onFileSelect
  * check for file extension
  * load lines into an array -> this.fileContent
  */
  onFileSelect(): void {
    this.uploadButtonText = "Upload a file";
    this.isFirstAddressCurrent = false;
    this.fileContent = [];
    const input = <HTMLInputElement>document.getElementById("file-input")
    const file = input.files[0];

    if (!file) return;

    if (!this.isFileYo(file)) {
      input.value = "";
      this.parserService.setFileContent(this.fileContent);
      return;
    }

    this.uploadButtonText = file.name;
    this.readFileAsText(file);
    this.onClickReset();
  }

  onClickContinue(): void {
    while (!this.stop) {
      this.onClickStep();
    }
  }

  onClickStep(): void {
    this.reset = false;
    this.isFirstAddressCurrent = false;
    var current = this.parserService.getCurrentLine();
    if (current.parsedLine.instruction == "") {
      this.setFirstCurrent();
      current = this.parserService.getCurrentLine();
    }
    var nextId = current.id + 1;
    if (current.id < this.fileContent.length && nextId < this.fileContent.length) {
      if (current.parsedLine.instruction != "" && !this.stop) {
        this.stop = this.cpuService.doSimulation(this.fileContent, current, this.freg, this.dreg, this.ereg, this.mreg, this.wreg);
        this.dstall = this.cpuService.getDstall();
        this.dbubble = this.cpuService.getDbubble();
      }
      this.nextCurrentLine();
    }
  }

  onClickReset(): void {
    this.reset = true;
    this.cpuService.reset(this.freg, this.dreg, this.ereg, this.mreg, this.wreg); 
    this.setFirstAddressCurrent();
    this.cycle = 0;

    this.cycle = 0;
    this.dstall = false;
    this.stop = false;
    this.counterStop = false;
    this.isFirstAddressCurrent = false;
    this.instructionLength = 0;

    this.loadlines();
  }

  onLoadSamples(): void {
    this.uploadButtonText = "Upload a file";
    this.fileContent = [];
    this.showSelectFile = false;
    let filename = (<HTMLInputElement>document.getElementById("dropdown")).value;
    if (filename !== "upload" && filename !== "choose") {
      let txt;
      let path = "assets/" + filename;

      var xhr = new XMLHttpRequest();
      xhr.open("GET", path, false);
      xhr.onload = function(e) {
        if (xhr.readyState === 4 && xhr.status === 200) {
          txt = xhr.responseText;
        }
      };

      xhr.send(null);

      this.isFirstAddressCurrent = false;
      this.fileContent = [];

      var blob = new Blob([txt], { type: 'text/plain' });
      var file = new File([blob], "foo.txt", { type: "text/plain" });

      this.readFileAsText(file);
      this.onClickReset();
    }
    if (filename == "choose") {
      this.fileContent = [];
    }
    if (filename == "upload") {
      this.showSelectFile = true;
    }

    if (this.fileContent.length == 0) {
      this.loadComponent = false;
    }
  }

  setFirstAddressCurrent(): void {
    if (!this.isFirstAddressCurrent) {
      for (let i = 0; i < this.fileContent.length; i++) {
        if (this.fileContent[i].isAnAddress) {
          this.fileContent[i].isCurrent = true;
          this.parserService.setCurrent(this.fileContent[i]);
          this.isFirstAddressCurrent = true;
          break;
        }
      }
    }
  }

  setFirstCurrent(): void {
    if (!this.isFirstAddressCurrent) {
      for (let i = 0; i < this.fileContent.length; i++) {
        if (this.fileContent[i].isAnAddress &&
        this.fileContent[i].parsedLine.instruction !== "" && 
        this.fileContent[i].parsedLine.address == this.cpuService.getSelectedPC().toNumber()) {
          this.fileContent[i].isCurrent = true;
          this.parserService.setCurrent(this.fileContent[i]);
          this.isFirstAddressCurrent = true;
          break;
        }
      }
    }
  }

  isFileYo(file: File): boolean {

    // .yo file types return "" when do file.type
    // this is to prevent against file.yo.txt
    if (file.name.split(".")[1] !== "yo" || file.type !== "") {
      alert('File type is not supported! Please upload a YO file');
      this.loadComponent = false;
      return false;
    }
    return true;
  }

  /*
  * nextCurrentLine
  * sets the next valid instruction to be the new current line
  */
  nextCurrentLine(): void {
    let current = this.parserService.getCurrentLine();

    let nextIndex = this.findIndex();

    if (nextIndex == 0) {
      nextIndex++;
    }
    for (let i = nextIndex; i < this.fileContent.length; i++) {
      let next = this.fileContent[i];
      if (next.parsedLine != null) {
        if (!this.cpuService.getDstall()) {
          this.parserService.setCurrent(next);
        } 
      }
      let newNextAddress = this.parserService.getCurrentLine().parsedLine.address;
      if (current.parsedLine != null && (current.parsedLine.address != 0 || (newNextAddress !== 0 && current.parsedLine.address == 0)) && !this.counterStop ) {
        //increment the clock-cycle
        if (this.stop) this.counterStop = true;
        this.cycle++;
      }
      break;
    }
  }

  /*
  * findIndex
  * find the line that contains the predPC to highlight
  */
  findIndex(): number {
    let index = 0;
    for (let i = 0; i < this.fileContent.length; i++) {
      if (this.fileContent[i].parsedLine !== null && this.fileContent[i].parsedLine.instruction !== "") {
        if (this.fileContent[i].parsedLine.address == this.cpuService.getSelectedPC().toNumber()) {
          index = i;
          break;
        }
        index = this.parserService.getCurrentLine().id;
      }
    }
    return index;
  }

  loadlines(): void {
    for (let i = 0; i < this.fileContent.length; i++) {
      if (this.fileContent[i].isAnAddress && this.fileContent[i].parsedLine.instruction !== "") {
        this.loadline(this.fileContent[i].parsedLine);
      }
    }
  }

  loadline(line: AddressLine): void {
    let bytes = line.instruction.length / 2;
    let position = 0;
    let address = line.address;
    while (bytes > 0) {
      let value = parseInt(line.instruction.substring(position, position + 2), 16);
      position += 2;
      bytes--;
      this.memoryService.putByte(Long.fromNumber(value), address);
      address++;
    }
  }

  readFileAsText(file: File): void {
    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      let lines = (fileReader.result as string).split(/[\r\n]+/g);
      let index = 0;
      for (let line of lines) {
        if (line[0] == "0") {
          this.fileContent.push({
            id: index,
            textLine: line,
            isAnAddress: true,
            isCurrent: false,
            parsedLine: this.parserService.parse(line),
          });

          if (this.fileContent[index].parsedLine.instruction != "" && // has an instruction
            (this.fileContent[index].parsedLine.instruction[0] != "0" || // not halt or constants
              (this.fileContent[index].parsedLine.instruction[0] == "0" && this.fileContent[index].parsedLine.instruction[1] == "0"))) //is halt 
          {
            this.instructionLength++;
          }
          index++;
        } else {
          this.fileContent.push({
            id: index,
            textLine: line,
            isAnAddress: false,
            isCurrent: false,
            parsedLine: null,
          });
          index++;
        }
      }
      this.parserService.setFileContent(this.fileContent);
      this.loadComponent = true;
      this.setFirstAddressCurrent();
      this.loadlines();
    }
    fileReader.readAsText(file);
  }
}
