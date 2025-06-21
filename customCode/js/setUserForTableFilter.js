async function setUserForTableFilter() {
    const getEmployee = $getGrid('employees').find((d) => d.user === fbUser.uid)
    console.log('getEmployee: ', getEmployee)

    $setUser('currentUser', getEmployee.rowKey)


}

window.setUserForTableFilter = setUserForTableFilter

setUserForTableFilter()
