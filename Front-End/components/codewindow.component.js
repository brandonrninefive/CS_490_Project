import React from 'react';
import brace from 'brace';
import AceEditor from './ace.component';

//browerify ace (brace) imports
import 'brace/mode/text';
import 'brace/mode/java';
import 'brace/mode/c_cpp';
import 'brace/mode/python';
import 'brace/theme/github';
import 'brace/keybinding/vim';
import 'brace/ext/language_tools';

/*need to import everything for later use*/

class CodeWindow extends React.Component {
    constructor(props){
	    super(props);
	    this.state = {
            mode:"text",
            theme:"github",
            keyboardHandler:"vim",
            file: '',
            body:''
	    };
	
        this.handleChange = this.handleChange.bind(this);
    }
    componentWillReceiveProps(nextProps)
    {
        /*Settings for changing themes and keyboard go here*/

        /*mode changes for here*/
        if(nextProps.aceMode != null && nextProps.aceMode != this.state.mode)
        {
            this.setState({mode: nextProps.aceMode});
        }

        if(nextProps.body != this.state.body)
        {
            this.setState({body: nextProps.body});
        }
    }
  
    handleChange(change)
    {
       this.props.rtuUpdate(change); 
    }

  render(){
    return(
	<AceEditor value={this.state.body} onLoad={this.props.editorOnLoad} onChange={this.handleChange} readOnly={this.props.readOnly} mode={this.state.mode} showPrintMargin={false} enableBasicAutocompletion={true} enableLiveAutocompletion={true} theme={this.state.theme} keyboardHandler={this.state.keyboardHandler} height={"100%"} width={"100%"} editorProps={{$blockScrolling: true}} />
    );
  }
}
export default CodeWindow
