package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

//TemplateValues 存储
var TemplateValues = make(map[string]string)

//MyWCommands window 命令
var MyWCommands = make(map[string]string)

//MyMCommands mac 命令
var MyMCommands = make(map[string]string)

var configPath = "./dark-pack.json"

func main() {

	path, _ := os.Getwd()

	TemplateValues["-baseDir"] = path

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

	if len(TemplateValues["-c"]) > 0 {
		configPath = TemplateValues["-c"]
	}

	if TemplateValues["push"] == "push" {
		push()
		fmt.Println("push finished!!!!")
	}

	if TemplateValues["pull"] == "pull" {
		pull()
		fmt.Println("pull finished!!!!")
	}

	props := readConfig()
	for k, v := range props.CommandsW {
		tags := findTag(v)
		if tags != nil {
			for i := 0; i < len(tags); i++ {
				tags[i] = strings.Replace(tags[i], "$D{", "", -1)
				tags[i] = strings.Replace(tags[i], "}", "", -1)
				tags[i] = strings.TrimSpace(tags[i])
				v = strings.Replace(v, "$D{"+tags[i]+"}", TemplateValues["-"+tags[i]], -1)
				os.Setenv("DARK_"+strings.ToUpper(tags[i]), TemplateValues["-"+tags[i]])
			}
		}
		MyWCommands[k] = v

	}

	for k, v := range props.CommandsM {
		tags := findTag(v)
		if tags != nil {
			for i := 0; i < len(tags); i++ {
				tags[i] = strings.Replace(tags[i], "$D{", "", -1)
				tags[i] = strings.Replace(tags[i], "}", "", -1)
				tags[i] = strings.TrimSpace(tags[i])
				v = strings.Replace(v, "$D{"+tags[i]+"}", TemplateValues["-"+tags[i]], -1)
				os.Setenv("DARK_"+strings.ToUpper(tags[i]), TemplateValues["-"+tags[i]])
			}
		}
		MyMCommands[k] = v
	}

	if "darwin" == runtime.GOOS {
		for k, v := range MyMCommands {
			if TemplateValues[k] == k {
				runCommand(v)
			}
		}
	} else {
		for k, v := range MyWCommands {
			if TemplateValues[k] == k {
				runCommand(v)
			}
		}
	}

}

//删除数组项
func remove(slice []string, index int) []string {
	return append(slice[0:index], slice[index+1:]...)
}

//执行本地命令
func runCommand(command string) {

	fmt.Println("==>runCommand: " + command)

	command = strings.TrimSpace(command)
	command = strings.Replace(command, "\t", " ", -1)
	command = strings.Replace(command, "\r", " ", -1)
	command = strings.Replace(command, "\n", " ", -1)
	command = strings.Replace(command, "  ", " ", -1)
	kvs := strings.Split(command, " ")
	command = kvs[0]
	kvs = remove(kvs, 0)
	cmd := exec.Command(command, kvs...)

	stderr, err1 := cmd.StderrPipe()

	if err1 != nil {
		fmt.Println(err1)
		return
	}
	stdout, err2 := cmd.StdoutPipe()

	if err2 != nil {
		fmt.Println(err2)
		return
	}

	go printStdout(stdout)

	go printStdout(stderr)

	cmd.Start()

	cmd.Wait()

}

func printStdout(stdout io.ReadCloser) {
	reader := bufio.NewReader(stdout)

	//实时循环读取输出流中的一行内容
	for {
		line, err := reader.ReadString('\n')
		if err != nil || io.EOF == err {
			break
		}
		fmt.Print(line)
	}
}

//更新
func pull() {

	props := readConfig()

	for i := 0; i < len(props.Files); i++ {
		httpGet(props.Files[i], props)

	}
}

//提交
func push() {
	props := readConfig()
	for i := 0; i < len(props.Files); i++ {
		uploadFile(props.Files[i], props)
	}
}

//下载文件
func httpGet(fileP File, props Props) {

	var suffix = ""
	if fileP.Suffix == "/" {
		suffix = ""
	} else {
		if len(fileP.Suffix) == 0 {
			suffix = ".template"
		} else {
			suffix = "." + fileP.Suffix
		}
	}

	resp, err := http.Get(props.RemotePath + "/" + fileP.Namespace + "/" + fileP.Version + "/" + fileP.Namespace + suffix)

	if err != nil {
		fmt.Println("文件未发现：" + fileP.Namespace)
		return
	}

	if resp.StatusCode != 200 {
		fmt.Println("文件未发现，请确认文件存在或检查网络：" + fileP.Namespace)
		return
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("error is %v\n", err)
	}

	var onlinefile = string(body)

	for k, v := range fileP.Template {
		tags := findTag(v)
		if tags != nil {
			for i := 0; i < len(tags); i++ {
				tags[i] = strings.Replace(tags[i], "$D{", "", -1)
				tags[i] = strings.Replace(tags[i], "}", "", -1)
				v = strings.Replace(v, "$D{"+tags[i]+"}", TemplateValues["-"+tags[i]], -1)
			}
		}
		onlinefile = strings.Replace(onlinefile, "$D{"+k+"}", v, -1)
	}

	var d1 = []byte(onlinefile)

	err2 := ioutil.WriteFile(fileP.Path, d1, 0666) //写入文件(字节数组)

	check(err2)

	fmt.Println("pull " + fileP.Namespace)
}

func check(e error) {
	if e != nil {
		panic(e)
	}
}

// Creates a new file upload http request with optional extra params
func newfileUploadRequest(uri string, params map[string]string, paramName, path string) (*http.Request, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(paramName, filepath.Base(path))
	if err != nil {
		return nil, err
	}
	_, err = io.Copy(part, file)

	for key, val := range params {
		_ = writer.WriteField(key, val)
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", uri, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req, err
}

//Props 属性配置
type Props struct {
	RemotePath string            `json:"remotePath"`
	Files      []File            `json:"files"`
	CommandsW  map[string]string `json:"commands-w"`
	CommandsM  map[string]string `json:"commands-m"`
}

//File 上传的文件
type File struct {
	Namespace string            `json:"namespace"`
	Suffix    string            `json:"suffix"`
	Version   string            `json:"version"`
	Path      string            `json:"path"`
	Template  map[string]string `json:"template"`
}

//读取配置
func readConfig() Props {
	var packJSON = readFile(configPath)

	props := Props{}

	err := json.Unmarshal([]byte(packJSON), &props)

	if err != nil {
		fmt.Printf("error is %v\n", err)
	}

	return props
}

//读取文件
func readFile(path string) string {
	fi, err := os.Open(path)
	if err != nil {
		panic(err)
	}
	defer fi.Close()
	fd, err := ioutil.ReadAll(fi)
	return string(fd)
}

//上传文件
func uploadFile(fileP File, props Props) {

	extraParams := map[string]string{
		"title":   fileP.Namespace,
		"author":  "Matt Aimonetti",
		"version": fileP.Version,
	}
	var suffix = ""
	if fileP.Suffix == "/" {
		suffix = ""
	} else {
		if len(fileP.Suffix) == 0 {
			suffix = ".template"
		} else {
			suffix = "." + fileP.Suffix
		}
	}

	path := fileP.Path + suffix

	_, err1 := os.Stat(path)
	if err1 != nil {
		fmt.Println(err1)
		return
	}

	request, err := newfileUploadRequest(props.RemotePath+"/upload", extraParams, "uploadfile", path)

	if err != nil {
		fmt.Println(err)
	}
	client := &http.Client{}
	resp, err := client.Do(request)
	if err != nil {
		fmt.Println(err)
	} else {
		body := &bytes.Buffer{}
		_, err := body.ReadFrom(resp.Body)
		if err != nil {
			fmt.Println(err)
		} else {
			result := "push " + fileP.Namespace + suffix + ", result=>" + body.String()
			fmt.Println(result)
		}

		resp.Body.Close()

	}
}

//查找标签
func findTag(str string) []string {
	reg := regexp.MustCompile(`<!--[^>]+>|\$D{[\S\s]+?}`)

	return reg.FindAllString(str, -1)
}
