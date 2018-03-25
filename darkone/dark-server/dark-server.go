package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

//TemplateValues 存储
var TemplateValues = make(map[string]string)

//Path 文件路径
var Path = ""

func main() {
	path, _ := os.Getwd()

	var port = "5555"

	for i := 0; i < len(os.Args); i++ {
		s := os.Args[i]
		kvs := strings.Split(s, "=")
		k := strings.TrimSpace(kvs[0])
		v := k
		if len(kvs) > 1 {
			v = strings.TrimSpace(kvs[1])
		}

		TemplateValues[k] = v
	}

	if TemplateValues["-rootDir"] != "" {
		Path = TemplateValues["-rootDir"]
	} else {
		Path = path + "/version/"
	}
	if !strings.HasSuffix(Path, "/") {
		Path += "/"
	}

	fmt.Printf(Path)
	http.Handle("/", http.FileServer(http.Dir(Path)))

	http.HandleFunc("/upload", upload)

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		panic(err)
	}

}

func upload(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(32 << 20)
	file, handler, err := r.FormFile("uploadfile")
	version := r.FormValue("version")
	title := r.FormValue("title")
	if err != nil {
		fmt.Println(err)
		fmt.Fprintln(w, err)
		return
	}
	defer file.Close()

	path := Path + title + "/" + version
	_, err1 := os.Stat(path)
	if err1 != nil {
		err := os.MkdirAll(path, 0777)
		if err != nil {
			fmt.Printf("%s", err)
			fmt.Fprintln(w, err)
		} else {
			fmt.Print("Create Directory OK!")
		}
	}
	fmt.Printf("上传文件%s\n", path+"/"+handler.Filename)

	_, err2 := os.Stat(path + "/" + handler.Filename)
	if err2 == nil {
		fmt.Printf("文件%s已经存在，移除之\n", path+"/"+handler.Filename)
		os.Remove(path + "/" + handler.Filename)
	}

	f, err := os.OpenFile(path+"/"+handler.Filename, os.O_WRONLY|os.O_CREATE, 0666)

	if err != nil {
		fmt.Println(err)
		fmt.Fprintln(w, err)
		return
	}
	defer f.Close()

	io.Copy(f, file)

	fmt.Printf("上传文件%s成功\n", path+"/"+handler.Filename)

	fmt.Fprintln(w, "upload ok!")
}
